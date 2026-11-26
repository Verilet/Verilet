import type { z } from 'zod';
import { readClientEnv } from './env';

/** Default client timeout in milliseconds for backend API requests. */
export const API_TIMEOUT_MS = 10_000;

/**
 * Dispatches a JSON POST request to the backend API with a standard timeout
 * and validates the parsed JSON response against a Zod schema.
 *
 * @param path API route path starting with `/` (e.g., `/api/evaluate`).
 * @param body Request payload to serialize as JSON.
 * @param responseSchema Zod schema validating the parsed response payload.
 * @returns Parsed and validated response data.
 * @throws {Error} When the HTTP response is non-2xx, times out, or fails schema validation.
 */
export async function postJson<T>(
  path: string,
  body: unknown,
  responseSchema: z.ZodType<T>,
): Promise<T> {
  const endpoint = `${readClientEnv().apiUrl}${path}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Request to ${path} failed with HTTP ${response.status}`);
  }

  const rawJson: unknown = await response.json();
  return responseSchema.parse(rawJson);
}
