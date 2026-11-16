import { z } from 'zod';

export const BEDROOM_VALUES = ['room', 'studio', '1', '2', '3', '4+'] as const;
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
export const CHECK_STATUSES = ['FLAG', 'UNKNOWN', 'OK'] as const;

const MAX_AMOUNT = 1_000_000;

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

const optionalAmount = z.number().finite().min(0).max(MAX_AMOUNT).nullable();

/** The listing details a student submits to be checked. See docs/specs/scans-api.md. */
export const scanInputSchema = z.strictObject({
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
});

export type ScanInput = z.infer<typeof scanInputSchema>;
export type Bedrooms = (typeof BEDROOM_VALUES)[number];
export type PaymentMethod = (typeof PAYMENT_VALUES)[number];
export type CheckStatus = (typeof CHECK_STATUSES)[number];

/** One line of a scan's result, such as the payment method check. */
export interface ScanCheck {
  id: string;
  title: string;
  detail: string;
  status: CheckStatus;
}

/** A saved scan as the API returns it. The owner's user ID is never included. */
export interface ScanResponse extends ScanInput {
  id: string;
  createdAt: string;
  score: number;
  checks: ScanCheck[];
}
