import { z } from 'zod';
import type { PriceCheckResult } from '../services/checkers/averagePrice.service.js';
import type { SecurityDepositResult } from '../services/securityDeposit.service.js';
import type { ApplicationFeeResult } from '../services/applicationFee.service.js';
import type { PaymentViolation } from '../services/paymentFlags.service.js';
import type { GisQueryResult } from '../services/gisQuery.service.js';
import type { LandUseResult } from '../services/landUse.service.js';
import type { PhoneFlagResult } from '../services/phoneFlags.service.js';
import type { AgencyVerificationResult } from '../services/agencyVerification.service.js';
import type { ListingSearchResult } from '../services/listingSearch.service.js';

/** Normalized status classification for an individual diagnostic check. */
export type CheckStatus = 'FLAG' | 'UNKNOWN' | 'OK' | 'SKIPPED';

/** Categorical risk rating tier for an evaluated rental listing. */
export type RiskRating = 'LOW' | 'MEDIUM' | 'HIGH' | 'INSUFFICIENT_DATA';

/** Standardized diagnostic check finding returned by the scoring engine. */
export interface CheckResult {
  readonly id: string;
  readonly title: string;
  readonly status: CheckStatus;
  readonly scoreImpact: number;
  readonly detail: string;
  readonly evidence: string | null;
}

/** Composite score result returned by {@link calculateListingScore} and `POST /api/evaluate`. */
export interface ScoreResult {
  readonly score: number | null;
  readonly rating: RiskRating;
  readonly summary: string;
  readonly checks: readonly CheckResult[];
}

/** Supported bedroom / space types for rental listings. */
export const BEDROOM_VALUES = ['room', 'studio', '1', '2', '3', '4+'] as const;

/** Bedroom category string derived from {@link BEDROOM_VALUES}. */
export type BedroomValue = (typeof BEDROOM_VALUES)[number];

/** Supported payment method selections. */
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

/** Payment method selection derived from {@link PAYMENT_VALUES}. */
export type PaymentValue = (typeof PAYMENT_VALUES)[number];

/**
 * Checks whether a string parses as a valid HTTP or HTTPS URL.
 *
 * @param value Raw URL candidate string.
 * @returns True when the string parses with an `http:` or `https:` protocol.
 */
function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Zod schema validating incoming rental listing payloads for full evaluation. */
export const EvaluateRequestSchema = z.object({
  /** Optional source listing URL (when provided, must be a valid HTTP/HTTPS URL). */
  listingUrl: z
    .string()
    .trim()
    .refine((url) => url === '' || isValidHttpUrl(url), {
      message: 'Listing URL must use HTTP or HTTPS protocol',
    })
    .nullish(),
  /** Monthly rent price in USD. */
  rent: z.number().positive('Rent must be greater than 0').finite('Rent must be a finite number'),
  /** Space / bedroom category. */
  bedrooms: z.enum(BEDROOM_VALUES, {
    message: 'Bedrooms must be one of: room, studio, 1, 2, 3, 4+',
  }),
  /** Freeform address or location string. */
  location: z.string().trim().min(1, 'Location is required'),
  /** Landlord or property management name. */
  landlord: z.string().trim().max(120, 'Landlord name must not exceed 120 characters').nullish(),
  /** Method of payment requested by lister (used in downstream scoring and duplicate search). */
  payment: z
    .union([z.literal(''), z.enum(PAYMENT_VALUES)])
    .transform((val) => (val === '' ? null : val))
    .nullish(),
  /** Requested security deposit in USD. */
  securityDeposit: z.number().min(0, 'Security deposit must be non-negative').finite().nullish(),
  /** Requested application screening fee in USD. */
  applicationFee: z.number().min(0, 'Application fee must be non-negative').finite().nullish(),
  /** Contact phone number string. */
  contactPhone: z.string().trim().nullish(),
  /** Listing description text. */
  description: z.string().trim().max(5000, 'Description must not exceed 5000 characters').nullish(),
});

/** Input type derived from EvaluateRequestSchema. */
export type EvaluateRequest = z.infer<typeof EvaluateRequestSchema>;

/** Fallback payload returned when an individual evaluation worker fails or times out. */
export interface WorkerFailureFallback {
  readonly status: 'skipped';
  readonly flag: null;
  readonly error: 'WORKER_FAILED';
}

/** Dictionary of raw evaluation check outputs returned from all 9 concurrent workers. */
export interface RawChecks {
  readonly price: PriceCheckResult | WorkerFailureFallback;
  readonly securityDeposit: SecurityDepositResult | WorkerFailureFallback;
  readonly applicationFee: ApplicationFeeResult | WorkerFailureFallback;
  readonly untraceablePayment: PaymentViolation[] | WorkerFailureFallback;
  readonly gisQuery: GisQueryResult | WorkerFailureFallback;
  readonly landUse: LandUseResult | WorkerFailureFallback;
  readonly contactPhone: PhoneFlagResult | WorkerFailureFallback;
  readonly agencyStanding: AgencyVerificationResult | WorkerFailureFallback;
  readonly listingSearch: ListingSearchResult | WorkerFailureFallback;
}

/** Standard response envelope returned by the listing evaluation orchestrator. */
export interface OrchestrationResponse {
  readonly success: true;
  readonly data: {
    readonly rawChecks: RawChecks;
  };
}

/** Standard successful POST /api/evaluate response envelope combining score and raw checks. */
export interface EvaluateResponse {
  readonly success: true;
  readonly data: ScoreResult & {
    readonly rawChecks: RawChecks;
  };
}
