import { z } from 'zod';

/** Where the Express API runs. Set VITE_API_URL to change it; local development uses port 5000. */
export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5000').replace(/\/$/, '');
const TIMEOUT_MS = 10_000;

/** A failed API call. `status` is the HTTP status, or 0 when the server couldn't be reached. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const errorEnvelope = z.object({ success: z.literal(false), error: z.string() });

interface RequestOptions<S extends z.ZodType> {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  /** Clerk session token, sent as a bearer token. */
  token?: string;
  /** Checks the `data` of a successful response. */
  schema: S;
}

/**
 * Calls the Verilet API and returns the parsed `data` of its success envelope. Throws `ApiError`
 * with the server's message on an error envelope, and on timeouts or unexpected responses.
 */
export async function apiRequest<S extends z.ZodType>(
  path: string,
  { method = 'GET', body, token, schema }: RequestOptions<S>,
): Promise<z.output<S>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError("We couldn't reach the server.", 0);
  } finally {
    clearTimeout(timer);
  }

  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const failure = errorEnvelope.safeParse(json);
    throw new ApiError(
      failure.success ? failure.data.error : `Request failed (${response.status}).`,
      response.status,
    );
  }
  const success = z.object({ success: z.literal(true), data: schema }).safeParse(json);
  if (!success.success) {
    throw new ApiError('The server sent an unexpected response.', response.status);
  }
  return (success.data as { data: z.output<S> }).data;
}
