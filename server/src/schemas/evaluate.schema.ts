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

/** Supported bedroom / space types for rental listings. */
export const BEDROOM_VALUES = ['room', 'studio', '1', '2', '3', '4+'] as const;
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
export type PaymentValue = (typeof PAYMENT_VALUES)[number];

/** Zod schema validating incoming rental listing payloads for full evaluation. */
export const EvaluateRequestSchema = z.object({
  /** Source listing URL (must be valid HTTP/HTTPS URL). */
  listingUrl: z
    .string()
    .url('A valid URL is required')
    .refine((url) => /^https?:\/\//i.test(url), {
      message: 'Listing URL must use HTTP or HTTPS protocol',
    }),
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
  payment: z.enum(PAYMENT_VALUES).nullish(),
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

/** Standard successful evaluation response envelope. */
export interface EvaluateResponse {
  readonly success: true;
  readonly data: {
    readonly rawChecks: RawChecks;
  };
}
