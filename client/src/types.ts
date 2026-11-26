import type { z } from 'zod';
import type { listingFormSchema } from './schemas/listing';

/** Supported composite risk rating tiers. */
export const RATING_VALUES = ['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA'] as const;
export type Rating = (typeof RATING_VALUES)[number];

/** Supported individual diagnostic check statuses. */
export const CHECK_STATUS_VALUES = ['FLAG', 'UNKNOWN', 'OK', 'SKIPPED'] as const;
export type CheckStatus = (typeof CHECK_STATUS_VALUES)[number];

export const BEDROOM_VALUES = ['room', 'studio', '1', '2', '3', '4+'] as const;
export type Bedrooms = (typeof BEDROOM_VALUES)[number];

const BEDROOM_LABELS: Record<Bedrooms, string> = {
  room: 'Room',
  studio: 'Studio',
  '1': '1 bed',
  '2': '2 bed',
  '3': '3 bed',
  '4+': '4+ bed',
};

export const BEDROOM_OPTIONS = BEDROOM_VALUES.map((value) => ({
  value,
  label: BEDROOM_LABELS[value],
}));

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
export type PaymentMethod = (typeof PAYMENT_VALUES)[number];

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  'bank-transfer': 'Bank transfer or ACH',
  check: 'Check or money order',
  'rental-platform': 'Through a rental platform',
  'zelle-venmo': 'Zelle, Venmo, or Cash App',
  cash: 'Cash',
  wire: 'Wire transfer',
  'gift-card': 'Gift card',
  crypto: 'Cryptocurrency',
  other: 'Something else',
};

export const PAYMENT_OPTIONS = PAYMENT_VALUES.map((value) => ({
  value,
  label: PAYMENT_LABELS[value],
}));

/** Validated form data, ready to send to the scan service. */
export type ListingInput = z.infer<typeof listingFormSchema>;

/** Represents a single normalized diagnostic check finding from an evaluation. */
export interface ScanCheck {
  /** Stable identifier for the diagnostic check (e.g., `'price'`, `'securityDeposit'`). */
  id: string;
  /** Human-readable check label shown in the results breakdown. */
  title: string;
  /** Plain-language explanation of the check finding, compliance state, or skip reason. */
  detail: string;
  /** Normalized diagnostic outcome classification for this check. */
  status: CheckStatus;
  /** Non-negative risk points contributed by this check to the composite score. */
  scoreImpact: number;
  /** Specific matched string, citation, or metric supporting the finding, or `null` when absent. */
  evidence: string | null;
}

/** Full evaluated rental listing scan result including submitted inputs and scoring output. */
export interface ScanResult extends ListingInput {
  /** Client-generated unique identifier for routing and session storage lookup. */
  id: string;
  /** ISO timestamp of when the listing was checked. */
  createdAt: string;
  /** Composite risk score from `0` (low risk) to `100` (high risk), or `null` when insufficient data. */
  score: number | null;
  /** Categorical risk rating from the scoring engine. */
  rating: Rating;
  /** Optional narrative summary returned by the evaluation endpoint. */
  summary?: string;
  /** Ordered list of normalized diagnostic check findings for this listing. */
  checks: ScanCheck[];
}
