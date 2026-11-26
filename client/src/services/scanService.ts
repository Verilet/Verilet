import { z } from 'zod';
import { postJson } from '../lib/api';
import { isScoreRatingConsistent, scanCheckSchema } from '../schemas/scan';
import {
  RATING_VALUES,
  type ListingInput,
  type PaymentMethod,
  type Rating,
  type ScanCheck,
  type ScanResult,
} from '../types';

/** Zod schema validating the standardized POST /api/evaluate JSON response envelope. */
const evaluateResponseSchema = z.object({
  success: z.literal(true),
  data: z
    .object({
      score: z.number().min(0).max(100).nullable(),
      rating: z.enum(RATING_VALUES),
      summary: z.string(),
      checks: z.array(scanCheckSchema),
    })
    .refine(isScoreRatingConsistent, {
      message: 'Evaluation score and rating are inconsistent.',
    }),
});

const RISKY_PAYMENTS: readonly PaymentMethod[] = ['gift-card', 'wire', 'crypto'];
const CAUTION_PAYMENTS: readonly PaymentMethod[] = ['zelle-venmo', 'cash', 'other'];

// Rough minimum "normal" monthly rent per listing type, used only by the local fixture helper.
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

/** Return payload produced by the local deterministic sample scorer {@link scoreListing}. */
export interface ScoreListingResult {
  /** Composite risk score between 0 and 100 matching the sum of check `scoreImpact` values. */
  score: number;
  /** Categorical risk tier for the sample listing. */
  rating: Exclude<Rating, 'INSUFFICIENT_DATA'>;
  /** Short narrative summary for the sample listing. */
  summary: string;
  /** Normalized diagnostic check breakdown. */
  checks: ScanCheck[];
}

/**
 * Maps a numeric 0–100 score to a non-insufficient risk tier for local sample fixtures.
 *
 * @param score Numeric composite risk score.
 * @returns Risk rating tier (`HIGH`, `MEDIUM`, or `LOW`).
 */
function localRatingFromScore(score: number): Exclude<Rating, 'INSUFFICIENT_DATA'> {
  if (score >= 70) {
    return 'HIGH';
  }
  if (score >= 40) {
    return 'MEDIUM';
  }
  return 'LOW';
}

/**
 * Local deterministic sample scorer retained for development mock data and existing unit tests.
 * Production submissions use {@link checkListing} against `POST /api/evaluate`.
 *
 * @param input Validated rental listing form values.
 * @returns Sample score, rating, summary, and check breakdown.
 */
export function scoreListing(input: ListingInput): ScoreListingResult {
  const checks: ScanCheck[] = [];

  const ratio = input.rent / TYPICAL_MIN_RENT[input.bedrooms];
  if (ratio < 0.6) {
    checks.push({
      id: 'rent',
      title: 'Rent vs. area price',
      detail: 'Rent is much lower than typical for this area',
      status: 'FLAG',
      scoreImpact: 40,
      evidence: `${Math.round(ratio * 100)}% of baseline`,
    });
  } else if (ratio < 0.85) {
    checks.push({
      id: 'rent',
      title: 'Rent vs. area price',
      detail: 'Rent is a little lower than typical for this area',
      status: 'UNKNOWN',
      scoreImpact: 0,
      evidence: null,
    });
  } else {
    checks.push({
      id: 'rent',
      title: 'Rent vs. area price',
      detail: 'Rent is in line with this area',
      status: 'OK',
      scoreImpact: 0,
      evidence: null,
    });
  }

  if (input.payment === null) {
    checks.push({
      id: 'payment',
      title: 'Payment method',
      detail: 'No payment method was given; check skipped',
      status: 'SKIPPED',
      scoreImpact: 0,
      evidence: null,
    });
  } else if (RISKY_PAYMENTS.includes(input.payment)) {
    checks.push({
      id: 'payment',
      title: 'Payment method',
      detail: PAYMENT_DETAIL[input.payment],
      status: 'FLAG',
      scoreImpact: 35,
      evidence: input.payment,
    });
  } else if (CAUTION_PAYMENTS.includes(input.payment)) {
    checks.push({
      id: 'payment',
      title: 'Payment method',
      detail: PAYMENT_DETAIL[input.payment],
      status: 'UNKNOWN',
      scoreImpact: 0,
      evidence: null,
    });
  } else {
    checks.push({
      id: 'payment',
      title: 'Payment method',
      detail: PAYMENT_DETAIL[input.payment],
      status: 'OK',
      scoreImpact: 0,
      evidence: null,
    });
  }

  const contactPhone = input.contactPhone ?? '';
  checks.push({
    id: 'contact',
    title: 'Contact info',
    detail: contactPhone
      ? 'Could not confirm the phone number is local'
      : 'No phone number was given; check skipped',
    status: contactPhone ? 'UNKNOWN' : 'SKIPPED',
    scoreImpact: 0,
    evidence: null,
  });

  const description = input.description ?? '';
  const photos = input.photos ?? [];
  const hasDetails = description !== '' || photos.length > 0;
  checks.push({
    id: 'details',
    title: 'Listing details',
    detail: hasDetails
      ? 'Photos and description look consistent'
      : 'No description or photos were added; check skipped',
    status: hasDetails ? 'OK' : 'SKIPPED',
    scoreImpact: 0,
    evidence: null,
  });

  const totalPoints = checks.reduce((sum, check) => sum + check.scoreImpact, 0);
  const cappedScore = Math.min(100, totalPoints);
  const rating = localRatingFromScore(cappedScore);

  return {
    score: cappedScore,
    rating,
    summary: `${rating === 'HIGH' ? 'High' : rating === 'MEDIUM' ? 'Moderate' : 'Low'} risk (${cappedScore}/100): sample listing check complete.`,
    checks,
  };
}

export type CheckListing = (input: ListingInput) => Promise<ScanResult>;

/**
 * Submits a validated listing to the backend `POST /api/evaluate` endpoint and normalizes
 * the Zod-validated scoring response into a `ScanResult`.
 *
 * @param input Validated rental listing form values.
 * @returns Normalized scan result containing score, rating, summary, and check diagnostics.
 * @throws {Error} When the HTTP request fails, times out, or returns an invalid payload.
 */
export const checkListing: CheckListing = async (input) => {
  const payload = {
    listingUrl: input.listingUrl,
    rent: input.rent,
    bedrooms: input.bedrooms,
    location: input.location,
    landlord: input.landlord,
    payment: input.payment,
    securityDeposit: input.securityDeposit,
    applicationFee: input.applicationFee,
    contactPhone: input.contactPhone,
    description: input.description,
  };

  const parsed = await postJson('/api/evaluate', payload, evaluateResponseSchema);

  return {
    ...input,
    id: `scan-${Date.now()}-${nextId++}`,
    createdAt: new Date().toISOString(),
    score: parsed.data.score,
    rating: parsed.data.rating,
    summary: parsed.data.summary,
    checks: parsed.data.checks,
  };
};
