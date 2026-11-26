import { z } from 'zod';
import { isInsufficientScan, ratingFromScore } from './risk';
import { isScoreRatingConsistent, scanCheckSchema } from '../schemas/scan';
import { BEDROOM_VALUES, PAYMENT_VALUES, RATING_VALUES, type ScanResult } from '../types';

const STORAGE_KEY = 'verilet:scans';

/** Common Zod fields shared by persisted and transient `ScanResult` payloads. */
const baseScanInputFields = {
  id: z.string(),
  createdAt: z.string(),
  summary: z.string().optional(),
  listingUrl: z.string(),
  rent: z.number(),
  bedrooms: z.enum(BEDROOM_VALUES),
  location: z.string(),
  landlord: z.string(),
  payment: z.enum(PAYMENT_VALUES).nullable(),
  securityDeposit: z.number().nullable(),
  applicationFee: z.number().nullable(),
  contactPhone: z.string(),
  description: z.string(),
};

/** Zod schema validating an in-memory transient `ScanResult` passed via router state. */
const transientScanStateSchema = z.object({
  transientScan: z
    .object({
      ...baseScanInputFields,
      score: z.number().min(0).max(100).nullable(),
      rating: z.enum(RATING_VALUES),
      checks: z.array(scanCheckSchema),
      photos: z.array(z.instanceof(File)).default([]),
    })
    .refine(isScoreRatingConsistent, {
      message: 'Transient scan score and rating are inconsistent.',
    }),
});

/** Zod schema validating and normalizing persisted scans (including legacy records). */
const storedScansSchema = z.array(
  z
    .object({
      ...baseScanInputFields,
      score: z.number(),
      rating: z.enum(RATING_VALUES).optional(),
      checks: z.array(
        scanCheckSchema.extend({
          scoreImpact: z.number().min(0).optional(),
          evidence: z.string().nullable().optional(),
        }),
      ),
    })
    .transform((scan): ScanResult => ({
      ...scan,
      rating: scan.rating ?? ratingFromScore(scan.score),
      checks: scan.checks.map((check) => ({
        ...check,
        scoreImpact: check.scoreImpact ?? 0,
        evidence: check.evidence ?? null,
      })),
      photos: [],
    })),
);

/**
 * Validates and extracts a transient non-persisted scan from React Router location state.
 *
 * @param state Unknown location state supplied by `useLocation()`.
 * @param scanId Optional route parameter identifying the expected scan.
 * @returns Validated `ScanResult` matching `scanId`, or `null` if absent or invalid.
 */
export function parseTransientScan(state: unknown, scanId?: string): ScanResult | null {
  if (!scanId) {
    return null;
  }
  const parsed = transientScanStateSchema.safeParse(state);
  if (!parsed.success || parsed.data.transientScan.id !== scanId) {
    return null;
  }
  return parsed.data.transientScan;
}

/**
 * Loads scored scans persisted for this browser tab from `sessionStorage`.
 * Legacy scans missing `rating`, `scoreImpact`, or `evidence` are normalized via Zod transforms.
 * Photo files cannot be stored in `sessionStorage` and are restored as empty arrays.
 *
 * @returns Array of restored `ScanResult` records, or `null` when empty or unreadable.
 */
export function loadScans(): ScanResult[] | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const scans = storedScansSchema.parse(JSON.parse(stored));
    return scans.length > 0 ? scans : null;
  } catch {
    return null;
  }
}

/**
 * Saves scored scans for this browser tab in `sessionStorage`.
 * Excludes `INSUFFICIENT_DATA` (`score: null`) scans and omits `photos` `File` objects.
 *
 * @param scans List of scan results to persist.
 */
export function saveScans(scans: ScanResult[]): void {
  try {
    const persistable = scans.filter((scan) => !isInsufficientScan(scan));
    const withoutPhotos = (key: string, value: unknown) => (key === 'photos' ? undefined : value);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistable, withoutPhotos));
  } catch {
    // Storage can be full or blocked. The scans still work until the page is refreshed.
  }
}
