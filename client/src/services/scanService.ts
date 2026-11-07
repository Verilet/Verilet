import type { ListingInput, PaymentMethod, ScanCheck, ScanResult } from '../types';

/**
 * PLACEHOLDER SCAN SERVICE.
 *
 * Scores a listing locally with a few simple rules so the UI can be built and tested before the
 * backend exists. Replace the body of `checkListing` with a call to the Express API
 * (validated with Zod, per docs/architecture.md); keep the signature.
 */

const RISKY_PAYMENTS: readonly PaymentMethod[] = ['gift-card', 'wire', 'crypto'];
const CAUTION_PAYMENTS: readonly PaymentMethod[] = ['zelle-venmo', 'cash', 'other'];

// Rough minimum "normal" monthly rent per listing type, used only by this placeholder.
const TYPICAL_MIN_RENT: Record<ListingInput['bedrooms'], number> = {
  room: 700,
  studio: 1300,
  '1': 1600,
  '2': 2100,
  '3': 2800,
  '4+': 3400,
};

const PAYMENT_DETAIL: Record<PaymentMethod, string> = {
  'bank-transfer': 'Landlord asks for a bank transfer',
  check: 'Landlord asks for a check or money order',
  'rental-platform': 'Landlord uses a rental platform',
  'zelle-venmo': 'Landlord asks for a peer-to-peer payment app',
  cash: 'Landlord asks for cash',
  wire: 'Landlord asks for payment by wire transfer',
  'gift-card': 'Landlord asks for payment by gift card',
  crypto: 'Landlord asks for payment in cryptocurrency',
  other: 'Landlord asks for an unusual payment method',
};

let nextId = 1;

export function scoreListing(input: ListingInput): Pick<ScanResult, 'score' | 'checks'> {
  const checks: ScanCheck[] = [];
  let score = 5;

  const ratio = input.rent / TYPICAL_MIN_RENT[input.bedrooms];
  if (ratio < 0.6) {
    checks.push({
      id: 'rent',
      title: 'Rent vs. area price',
      detail: 'Rent is much lower than typical for this area',
      status: 'FLAG',
    });
    score += 40;
  } else if (ratio < 0.85) {
    checks.push({
      id: 'rent',
      title: 'Rent vs. area price',
      detail: 'Rent is a little lower than typical for this area',
      status: 'UNKNOWN',
    });
    score += 15;
  } else {
    checks.push({
      id: 'rent',
      title: 'Rent vs. area price',
      detail: 'Rent is in line with this area',
      status: 'OK',
    });
  }

  if (RISKY_PAYMENTS.includes(input.payment)) {
    checks.push({
      id: 'payment',
      title: 'Payment method',
      detail: PAYMENT_DETAIL[input.payment],
      status: 'FLAG',
    });
    score += 35;
  } else if (CAUTION_PAYMENTS.includes(input.payment)) {
    checks.push({
      id: 'payment',
      title: 'Payment method',
      detail: PAYMENT_DETAIL[input.payment],
      status: 'UNKNOWN',
    });
    score += 10;
  } else {
    checks.push({
      id: 'payment',
      title: 'Payment method',
      detail: PAYMENT_DETAIL[input.payment],
      status: 'OK',
    });
  }

  checks.push({
    id: 'landlord',
    title: 'Landlord check',
    detail: input.landlord ? 'No record found for this landlord' : 'No landlord name was given',
    status: 'UNKNOWN',
  });
  score += 10;

  checks.push({
    id: 'details',
    title: 'Listing details',
    detail: 'Photos and description look consistent',
    status: 'OK',
  });

  return { score: Math.min(100, score), checks };
}

export type CheckListing = (input: ListingInput) => Promise<ScanResult>;

export const checkListing: CheckListing = async (input) => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return {
    ...input,
    ...scoreListing(input),
    id: `scan-${Date.now()}-${nextId++}`,
    createdAt: new Date().toISOString(),
  };
};
