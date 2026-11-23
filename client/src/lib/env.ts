import { z } from 'zod';
import { publishableKeySchema } from '../auth/authState';

/**
 * The API's base address, e.g. `http://localhost:5000`, without a trailing slash. Only http and
 * https addresses count.
 */
const apiUrlSchema = z
  .string()
  .trim()
  .pipe(z.url({ protocol: /^https?$/ }))
  .transform((url) => url.replace(/\/+$/, ''));

/**
 * The variables the client reads from `client/.env`. Each one is checked on its own, so one bad
 * value never breaks the others.
 */
const rawEnvSchema = z
  .object({
    VITE_API_URL: z.unknown(),
    VITE_CLERK_PUBLISHABLE_KEY: z.unknown(),
  })
  // Either variable can be left out of `.env`; Zod treats object keys as required otherwise.
  .partial();

/** The client's settings, checked and ready to use. */
export interface ClientEnv {
  /** The API's base address, or an empty string to call the API on this site. */
  apiUrl: string;
  /** Clerk publishable key, or null when sign-in is off. */
  clerkPublishableKey: string | null;
}

/**
 * Checks one variable. A missing or empty one gives the fallback quietly; one that is set but
 * isn't valid also gives the fallback, with a warning on the dev server so the mistake is easy
 * to find. Never throws, so a bad `.env` can't stop the app from loading.
 *
 * @param name The variable's name, for the warning.
 * @param value The variable's value.
 * @param schema What a valid value looks like.
 * @param fallback What to use instead of a missing or invalid value.
 * @returns The checked value, or the fallback.
 */
function readVariable<T>(name: string, value: unknown, schema: z.ZodType<T>, fallback: T): T {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return fallback;
  }
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  if (import.meta.env.MODE === 'development') {
    console.warn(`${name} in client/.env isn't valid, so it is being ignored.`);
  }
  return fallback;
}

/**
 * Reads the client's settings from the environment.
 *
 * @param env The environment to read, `import.meta.env` unless a test passes its own.
 * @returns The checked settings: an invalid API address calls the API on this site, and an
 *   invalid Clerk key turns sign-in off.
 */
export function readClientEnv(env: unknown = import.meta.env): ClientEnv {
  const raw = rawEnvSchema.safeParse(env);
  const vars = raw.success
    ? raw.data
    : { VITE_API_URL: undefined, VITE_CLERK_PUBLISHABLE_KEY: undefined };
  return {
    apiUrl: readVariable('VITE_API_URL', vars.VITE_API_URL, apiUrlSchema, ''),
    clerkPublishableKey: readVariable(
      'VITE_CLERK_PUBLISHABLE_KEY',
      vars.VITE_CLERK_PUBLISHABLE_KEY,
      publishableKeySchema,
      null,
    ),
  };
}
