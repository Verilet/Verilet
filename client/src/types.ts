export type Rating = 'HIGH' | 'MEDIUM' | 'LOW';
export type CheckStatus = 'FLAG' | 'UNKNOWN' | 'OK';

export const BEDROOM_OPTIONS = [
  { value: 'room', label: 'Room' },
  { value: 'studio', label: 'Studio' },
  { value: '1', label: '1 bed' },
  { value: '2', label: '2 bed' },
  { value: '3', label: '3 bed' },
  { value: '4+', label: '4+ bed' },
] as const;

export type Bedrooms = (typeof BEDROOM_OPTIONS)[number]['value'];

export const PAYMENT_OPTIONS = [
  { value: 'bank-transfer', label: 'Bank transfer or ACH' },
  { value: 'check', label: 'Check or money order' },
  { value: 'rental-platform', label: 'Through a rental platform' },
  { value: 'zelle-venmo', label: 'Zelle, Venmo, or Cash App' },
  { value: 'cash', label: 'Cash' },
  { value: 'wire', label: 'Wire transfer' },
  { value: 'gift-card', label: 'Gift card' },
  { value: 'crypto', label: 'Cryptocurrency' },
  { value: 'other', label: 'Something else' },
] as const;

export type PaymentMethod = (typeof PAYMENT_OPTIONS)[number]['value'];

/** Validated form data, ready to send to the scan service. */
export interface ListingInput {
  listingUrl: string;
  rent: number;
  bedrooms: Bedrooms;
  location: string;
  landlord: string;
  payment: PaymentMethod;
}

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
