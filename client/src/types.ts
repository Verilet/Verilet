import type { z } from 'zod';
import type { listingFormSchema } from './schemas/listing';

export type Rating = 'HIGH' | 'MEDIUM' | 'LOW';
export type CheckStatus = 'FLAG' | 'UNKNOWN' | 'OK';

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

export interface ScanCheck {
  id: string;
  title: string;
  detail: string;
  status: CheckStatus;
}

export interface ScanResult extends ListingInput {
  id: string;
  /** ISO timestamp of when the listing was checked. */
  createdAt: string;
  /** 0 (low risk) to 100 (high risk). */
  score: number;
  checks: ScanCheck[];
}
