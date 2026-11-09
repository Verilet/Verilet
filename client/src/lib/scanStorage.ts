import { z } from 'zod';
import type { ScanResult } from '../types';
import { BEDROOM_VALUES, PAYMENT_VALUES } from '../types';

const STORAGE_KEY = 'verilet:scans';

const storedScansSchema = z.array(
  z.object({
    id: z.string(),
    createdAt: z.string(),
    score: z.number(),
    checks: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        detail: z.string(),
        status: z.enum(['FLAG', 'UNKNOWN', 'OK']),
      }),
    ),
    listingUrl: z.string(),
    rent: z.number(),
    bedrooms: z.enum(BEDROOM_VALUES),
    location: z.string(),
    landlord: z.string(),
    payment: z.enum(PAYMENT_VALUES),
    securityDeposit: z.number().nullable(),
    applicationFee: z.number().nullable(),
    contactPhone: z.string(),
    description: z.string(),
  }),
);

/**
 * Placeholder for loading scans from the API. Keeps scans for the browser tab so a refreshed
 * results page can still open them. Photo files can't be stored, so they come back empty; the
 * saved checks already reflect them.
 */
export function loadScans(): ScanResult[] | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const scans = storedScansSchema.parse(JSON.parse(stored));
    return scans.length > 0 ? scans.map((scan) => ({ ...scan, photos: [] })) : null;
  } catch {
    return null;
  }
}

/** Saves scans for this browser tab. Photo files are left out because they can't be stored. */
export function saveScans(scans: ScanResult[]): void {
  try {
    const withoutPhotos = (key: string, value: unknown) => (key === 'photos' ? undefined : value);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(scans, withoutPhotos));
  } catch {
    // Storage can be full or blocked. The scans still work until the page is refreshed.
  }
}
