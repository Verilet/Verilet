import { z } from 'zod';
import { scanResultSchema, scoredSchema, type ScanPayload } from '../schemas/scan';
import type { ListingInput, ScanResult } from '../types';
import { ApiError, apiRequest } from './apiClient';
import type { CheckListing } from './scanService';

/** A signed-in student's saved scans on the server. See docs/specs/scans-api.md. */
export interface ScansApi {
  /** Scores and saves a listing from the form. */
  create: CheckListing;
  /** Scores and saves a listing that was already turned into a payload, like a guest's check. */
  save: (payload: ScanPayload) => Promise<ScanResult>;
  /** The student's scans, newest first. */
  list: () => Promise<ScanResult[]>;
  /** One scan, or null if it doesn't exist or isn't theirs. */
  get: (id: string) => Promise<ScanResult | null>;
}

/** The listing as the API takes it: photo files are counted, not uploaded. */
export function toPayload({ photos, ...input }: ListingInput): ScanPayload {
  return { ...input, photoCount: photos.length };
}

/** Scores a listing without an account or saving it. Limited per address on the server. */
export async function checkAsGuest(payload: ScanPayload) {
  return apiRequest('/api/check', { method: 'POST', body: payload, schema: scoredSchema });
}

/** Builds the scans API for a signed-in student, using Clerk's `getToken` for each request. */
export function createScansApi(getToken: () => Promise<string | null>): ScansApi {
  async function token() {
    const value = await getToken();
    if (!value) {
      throw new ApiError('Log in to continue.', 401);
    }
    return value;
  }

  async function save(payload: ScanPayload) {
    return apiRequest('/api/scans', {
      method: 'POST',
      token: await token(),
      body: payload,
      schema: scanResultSchema,
    });
  }

  return {
    create: (input) => save(toPayload(input)),
    save,
    list: async () =>
      apiRequest('/api/scans', { token: await token(), schema: z.array(scanResultSchema) }),
    get: async (id) => {
      try {
        return await apiRequest(`/api/scans/${encodeURIComponent(id)}`, {
          token: await token(),
          schema: scanResultSchema,
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
  };
}
