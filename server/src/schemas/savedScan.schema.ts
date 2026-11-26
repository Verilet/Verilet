import { z } from 'zod';

/** The listing types the form offers. */
export const BEDROOM_VALUES = ['room', 'studio', '1', '2', '3', '4+'] as const;

/** The payment methods the form offers. */
export const PAYMENT_VALUES = [
  'bank-transfer',
  'check',
  'rental-platform',
  'zelle-venmo',
  'cash',
  'wire',
  'gift-card',
  'crypto',
  'other',
] as const;

/** How one check on a scan came out. */
export const CHECK_STATUSES = ['FLAG', 'UNKNOWN', 'OK'] as const;

/** The largest rent, deposit or fee accepted, to keep obviously wrong numbers out. */
const MAX_AMOUNT = 1_000_000;

/** The most checks one scan can hold. */
const MAX_CHECKS = 20;

/**
 * Whether a string is an http or https link.
 *
 * @param value The text to test.
 * @returns True for an http(s) URL.
 */
function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** A deposit or fee: a non-negative amount, or null when the listing doesn't say. */
const optionalAmount = z.number().finite().min(0).max(MAX_AMOUNT).nullable();

/** One line of a scan's result, such as the payment method check. */
export const scanCheckSchema = z.strictObject({
  id: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(120),
  detail: z.string().trim().max(1000),
  status: z.enum(CHECK_STATUSES),
});

/**
 * A scan to save: the listing as the student entered it, plus the score and checks it was given.
 * The server stores the scan as it was evaluated and doesn't score it. See docs/specs/scans-api.md.
 */
export const saveScanRequestSchema = z.strictObject({
  listingUrl: z.string().trim().min(1).max(2048).refine(isHttpUrl, 'Must be an http(s) link.'),
  rent: z.number().finite().positive().max(MAX_AMOUNT),
  bedrooms: z.enum(BEDROOM_VALUES),
  location: z.string().trim().min(2).max(200),
  landlord: z.string().trim().max(120),
  payment: z.enum(PAYMENT_VALUES),
  securityDeposit: optionalAmount,
  applicationFee: optionalAmount,
  contactPhone: z.string().trim().max(40),
  description: z.string().trim().max(5000),
  photoCount: z.number().int().min(0).max(10),
  score: z.number().int().min(0).max(100),
  checks: z.array(scanCheckSchema).max(MAX_CHECKS),
});

/** A scan to save, after validation. */
export type SaveScanRequest = z.infer<typeof saveScanRequestSchema>;

/** One line of a scan's result. */
export type ScanCheck = z.infer<typeof scanCheckSchema>;

/** A saved scan as the API returns it. The owner's user ID is never included. */
export interface SavedScanResponse extends SaveScanRequest {
  /** The scan's ID: a MongoDB ObjectId as a string. */
  id: string;
  /** When it was saved, as an ISO timestamp. */
  createdAt: string;
}
