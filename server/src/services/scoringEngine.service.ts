import type { RawChecks, WorkerFailureFallback } from '../schemas/evaluate.schema.js';
import type { ListingMatch } from './listingSearch.service.js';

/** Evaluation status of an individual diagnostic check. */
export type CheckStatus = 'FLAG' | 'UNKNOWN' | 'OK' | 'SKIPPED';

/** Overall risk tier rating for a rental listing. */
export type RiskRating = 'LOW' | 'MEDIUM' | 'HIGH' | 'INSUFFICIENT_DATA';

/** Standardized diagnostic check finding. */
export interface CheckResult {
  /** Unique identifier for the diagnostic check. */
  readonly id: string;
  /** Human-readable title for the check. */
  readonly title: string;
  /** Normalized status classification. */
  readonly status: CheckStatus;
  /** Point impact added to composite risk score. */
  readonly scoreImpact: number;
  /** Clear explanation of the check finding or compliance state. */
  readonly detail: string;
  /** Optional matched evidence string, citation, or key triggering the finding. */
  readonly evidence?: string | null;
}

/** Comprehensive composite score result returned by the scoring engine. */
export interface ScoreResult {
  /** Capped composite score between 0 and 100, or null if insufficient data. */
  readonly score: number | null;
  /** Categorical risk rating. */
  readonly rating: RiskRating;
  /** Human-readable narrative summary explaining the risk level. */
  readonly summary: string;
  /** Normalized breakdown of all diagnostic checks. */
  readonly checks: readonly CheckResult[];
}

/** Point weight: Untraceable payment methods (cryptocurrency, wire transfer, gift cards). */
export const POINTS_UNTRACEABLE_PAYMENT = 40;

/** Point weight: Advance-fee P2P payment requests prior to viewing/touring. */
export const POINTS_ADVANCE_FEE = 35;

/** Point weight: Monthly rent less than 50% of regional baseline average. */
export const POINTS_RENT_UNDER_50 = 35;

/** Point weight: Monthly rent between 50% and 75% of regional baseline average. */
export const POINTS_RENT_UNDER_75 = 15;

/** Point weight: Cross-platform duplicate listing mismatch found. */
export const POINTS_DUPLICATE_MISMATCH = 35;

/** Point weight: Corporate or property agency suspended in official business registry. */
export const POINTS_SUSPENDED_ENTITY = 30;

/** Point weight: Corporate or property agency not found or unregistered. */
export const POINTS_UNREGISTERED_ENTITY = 10;

/** Point weight: Address not found in county GIS assessor parcel records. */
export const POINTS_UNVERIFIED_ADDRESS = 25;

/** Point weight: Assessor parcel designated for commercial or vacant land use. */
export const POINTS_LAND_USE_MISMATCH = 25;

/** Point weight: Obfuscated contact phone/email patterns detected in description. */
export const POINTS_OBFUSCATED_CONTACT = 25;

/** Point weight: Out-of-state area code or international phone prefix. */
export const POINTS_NON_LOCAL_PHONE = 15;

/** Point weight: Security deposit exceeds California statutory 2x rent cap (illegal deposit). */
export const POINTS_DEPOSIT_OVER_2X = 25;

/** Point weight: Security deposit exceeds standard California 1x rent cap (standard cap). */
export const POINTS_DEPOSIT_OVER_1X = 10;

/** Point weight: Application screening fee exceeds statutory cap ($65). */
export const POINTS_EXCESSIVE_FEE = 15;

/** Minimum number of evaluated checks required to produce a composite risk score. */
export const MIN_EVALUATED_CHECKS_THRESHOLD = 3;

/** Number of cross-platform duplicate search providers ('address' and 'photo'). */
const LISTING_SEARCH_SOURCE_COUNT = 2;

/** P2P payment app tokens classified separately from crypto/wire/gift-card untraceable methods. */
const P2P_PAYMENT_KEYS = new Set(['zelle', 'venmo', 'cashapp', 'chime']);

/** Standard explanation returned when listing has insufficient evaluable data. */
export const INSUFFICIENT_DATA_SUMMARY =
  'Could not evaluate listing due to insufficient data. Please add details to calculate risk.';

/** Standard success/failure envelope shape shared by evaluation worker services. */
type WorkerEnvelope<TData> =
  | { readonly success: true; readonly data: TData }
  | { readonly success: false; readonly error: string };

/** Default messages used when unwrapping standard worker envelopes. */
interface EnvelopeFallbackMessages {
  readonly workerFailureDetail: string;
  readonly invalidInputDetail: string;
  readonly skippedDetail: string;
}

/**
 * Type guard verifying whether a raw worker output is a worker failure fallback object.
 *
 * @param val Untrusted worker output value.
 * @returns True if the value is a WorkerFailureFallback.
 */
export function isWorkerFailure(val: unknown): val is WorkerFailureFallback {
  return val != null && typeof val === 'object' && 'error' in val && val.error === 'WORKER_FAILED';
}

/**
 * Returns a trimmed non-empty message or a descriptive fallback when blank/nullish.
 */
function nonEmptyDetail(message: string | null | undefined, fallback: string): string {
  const trimmed = message?.trim();
  return trimmed ? trimmed : fallback;
}

/**
 * Constructs a normalized CheckResult object.
 */
function createCheckResult(
  id: string,
  title: string,
  status: CheckStatus,
  scoreImpact: number,
  detail: string,
  evidence: string | null = null,
): CheckResult {
  return { id, title, status, scoreImpact, detail, evidence };
}

function unknownCheck(id: string, title: string, detail: string): CheckResult {
  return createCheckResult(id, title, 'UNKNOWN', 0, detail, null);
}

function skippedCheck(id: string, title: string, detail: string): CheckResult {
  return createCheckResult(id, title, 'SKIPPED', 0, detail, null);
}

function okCheck(
  id: string,
  title: string,
  detail: string,
  evidence: string | null = null,
): CheckResult {
  return createCheckResult(id, title, 'OK', 0, detail, evidence);
}

function flagCheck(
  id: string,
  title: string,
  scoreImpact: number,
  detail: string,
  evidence: string | null = null,
): CheckResult {
  return createCheckResult(id, title, 'FLAG', scoreImpact, detail, evidence);
}

/**
 * Handles common worker-failure, invalid-input, and skipped states for envelope-based workers
 * before delegating active findings to the check-specific mapper.
 */
function normalizeEnvelopeCheck<
  TData extends { readonly status: string; readonly message?: string },
>(
  raw: WorkerEnvelope<TData> | WorkerFailureFallback | undefined,
  id: string,
  title: string,
  defaults: EnvelopeFallbackMessages,
  mapData: (data: TData) => CheckResult,
): CheckResult {
  if (!raw || isWorkerFailure(raw)) {
    return unknownCheck(id, title, defaults.workerFailureDetail);
  }
  if (!raw.success) {
    return unknownCheck(id, title, nonEmptyDetail(raw.error, defaults.invalidInputDetail));
  }
  if (raw.data.status === 'skipped') {
    return skippedCheck(id, title, nonEmptyDetail(raw.data.message, defaults.skippedDetail));
  }
  return mapData(raw.data);
}

/**
 * Builds a fallback price explanation when the price worker provides an empty explanation.
 */
function buildPriceFallbackDetail(
  rent: number,
  baseline: number | null,
  severityLabel: 'severely' | 'moderately',
): string {
  return baseline != null
    ? `Rent ($${rent}) is ${severityLabel} below the baseline ($${baseline}).`
    : `Rent ($${rent}) is ${severityLabel} below the regional average baseline.`;
}

/**
 * Normalizes price baseline check worker output into a standard CheckResult.
 *
 * @param price Raw output from average price checker worker or fallback.
 * @returns Normalized price CheckResult.
 */
function normalizePrice(price: RawChecks['price']): CheckResult {
  const id = 'price';
  const title = 'Price Baseline Comparison';

  if (!price || isWorkerFailure(price)) {
    return unknownCheck(
      id,
      title,
      'Price evaluation could not be completed due to worker failure.',
    );
  }

  if (price.status === 'not_evaluated') {
    return unknownCheck(
      id,
      title,
      nonEmptyDetail(
        price.explanation,
        'No regional baseline price data found for comparison in this space type or location.',
      ),
    );
  }

  const percent = price.percentOfBaseline;
  const evidence = percent != null ? `${percent}% of baseline` : null;

  if (price.status === 'violation' || (percent != null && percent < 50)) {
    return flagCheck(
      id,
      title,
      POINTS_RENT_UNDER_50,
      nonEmptyDetail(
        price.explanation,
        buildPriceFallbackDetail(price.rent, price.baseline, 'severely'),
      ),
      evidence,
    );
  }

  if (percent == null) {
    return unknownCheck(
      id,
      title,
      nonEmptyDetail(price.explanation, 'Price baseline comparison percentage is unavailable.'),
    );
  }

  if (percent <= 75) {
    return flagCheck(
      id,
      title,
      POINTS_RENT_UNDER_75,
      nonEmptyDetail(
        price.explanation,
        buildPriceFallbackDetail(price.rent, price.baseline, 'moderately'),
      ),
      evidence,
    );
  }

  return okCheck(
    id,
    title,
    nonEmptyDetail(price.explanation, 'Rent is consistent with regional baseline averages.'),
    evidence,
  );
}

/**
 * Normalizes security deposit legal cap worker output into a standard CheckResult.
 *
 * @param deposit Raw output from security deposit worker or fallback.
 * @returns Normalized security deposit CheckResult.
 */
function normalizeSecurityDeposit(deposit: RawChecks['securityDeposit']): CheckResult {
  const id = 'securityDeposit';
  const title = 'Security Deposit Legal Cap';

  return normalizeEnvelopeCheck(
    deposit,
    id,
    title,
    {
      workerFailureDetail: 'Security deposit check could not be completed due to worker failure.',
      invalidInputDetail: 'Invalid security deposit input parameters.',
      skippedDetail: 'Security deposit not specified; check skipped.',
    },
    (data) => {
      if (data.flag === 'ILLEGAL_SECURITY_DEPOSIT') {
        return flagCheck(
          id,
          title,
          POINTS_DEPOSIT_OVER_2X,
          nonEmptyDetail(
            data.message,
            'Security deposit exceeds California statutory 2x rent cap.',
          ),
          data.statutoryCitation ?? 'Cal. Civ. Code § 1950.5(c)',
        );
      }

      if (data.flag === 'EXCEEDS_STANDARD_DEPOSIT_CAP') {
        return flagCheck(
          id,
          title,
          POINTS_DEPOSIT_OVER_1X,
          nonEmptyDetail(data.message, 'Security deposit exceeds standard California 1x rent cap.'),
          data.statutoryCitation ?? 'Cal. Civ. Code § 1950.5(c)',
        );
      }

      return okCheck(
        id,
        title,
        nonEmptyDetail(
          data.message,
          'Security deposit complies with California AB 12 statutory cap.',
        ),
        data.statutoryCitation ?? null,
      );
    },
  );
}

/**
 * Normalizes application screening fee worker output into a standard CheckResult.
 *
 * @param fee Raw output from application screening fee worker or fallback.
 * @returns Normalized application fee CheckResult.
 */
function normalizeApplicationFee(fee: RawChecks['applicationFee']): CheckResult {
  const id = 'applicationFee';
  const title = 'Application Screening Fee Cap';

  return normalizeEnvelopeCheck(
    fee,
    id,
    title,
    {
      workerFailureDetail: 'Application fee check could not be completed due to worker failure.',
      invalidInputDetail: 'Invalid application fee input parameters.',
      skippedDetail: 'Application fee not specified; check skipped.',
    },
    (data) => {
      if (data.status === 'violation' || data.flag === 'EXCESSIVE_APPLICATION_FEE') {
        return flagCheck(
          id,
          title,
          POINTS_EXCESSIVE_FEE,
          nonEmptyDetail(data.message, 'Application screening fee exceeds statutory limit.'),
          data.statutoryCitation ?? 'Cal. Civ. Code § 1950.6',
        );
      }

      return okCheck(
        id,
        title,
        nonEmptyDetail(
          data.message,
          'Application screening fee complies with California statutory limits.',
        ),
        data.statutoryCitation ?? null,
      );
    },
  );
}

/**
 * Normalizes a payment evidence string to match P2P lookup keys.
 */
function normalizePaymentKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/**
 * Normalizes untraceable and advance fee payment worker output into a standard CheckResult.
 *
 * @param payment Raw payment violation array or worker failure fallback.
 * @returns Normalized payment method CheckResult.
 */
function normalizePayment(payment: RawChecks['untraceablePayment']): CheckResult {
  const id = 'untraceablePayment';
  const title = 'Payment Method Security';

  if (!payment || isWorkerFailure(payment) || !Array.isArray(payment)) {
    return unknownCheck(
      id,
      title,
      'Payment risk check could not be completed due to worker failure.',
    );
  }

  if (payment.length === 0) {
    return okCheck(id, title, 'No high-risk or untraceable payment demands detected.');
  }

  // Cap each payment risk category once; route P2P selections to advance-fee weight and crypto/wire/gift to untraceable.
  let hasUntraceable = false;
  let hasAdvanceFee = false;
  const titles = new Set<string>();
  const evidences = new Set<string>();

  for (const violation of payment) {
    switch (violation.code) {
      case 'UNTRACEABLE_PAYMENT': {
        hasUntraceable = true;
        break;
      }
      case 'HIGH_RISK_PAYMENT_METHOD': {
        const key = normalizePaymentKey(violation.evidence);
        if (P2P_PAYMENT_KEYS.has(key)) {
          hasAdvanceFee = true;
        } else {
          hasUntraceable = true;
        }
        break;
      }
      case 'ADVANCE_FEE_DEPOSIT': {
        hasAdvanceFee = true;
        break;
      }
    }

    const trimmedTitle = violation.title.trim();
    if (trimmedTitle) {
      titles.add(trimmedTitle);
    }
    const trimmedEvidence = violation.evidence.trim();
    if (trimmedEvidence) {
      evidences.add(trimmedEvidence);
    }
  }

  const points =
    (hasUntraceable ? POINTS_UNTRACEABLE_PAYMENT : 0) + (hasAdvanceFee ? POINTS_ADVANCE_FEE : 0);

  if (points === 0) {
    return unknownCheck(id, title, 'Payment risk check returned unrecognized violation data.');
  }

  const detail = [...titles].join(' ') || 'High-risk or untraceable payment method detected.';

  return flagCheck(id, title, points, detail, [...evidences].join(', ') || null);
}

/**
 * Normalizes county GIS assessor parcel query worker output into a standard CheckResult.
 *
 * @param gis Raw GIS assessor query output or worker failure fallback.
 * @returns Normalized GIS query CheckResult.
 */
function normalizeGisQuery(gis: RawChecks['gisQuery']): CheckResult {
  const id = 'gisQuery';
  const title = 'County GIS Property Records';

  return normalizeEnvelopeCheck(
    gis,
    id,
    title,
    {
      workerFailureDetail:
        'County GIS property check could not be completed due to worker failure.',
      invalidInputDetail: 'Invalid address for county GIS verification.',
      skippedDetail: 'Address not specified or GIS service unavailable; check skipped.',
    },
    (data) => {
      if (data.flag === 'UNVERIFIED_ADDRESS' || data.status === 'warning') {
        return flagCheck(
          id,
          title,
          POINTS_UNVERIFIED_ADDRESS,
          nonEmptyDetail(
            data.message,
            'Address could not be verified in county assessor parcel records.',
          ),
        );
      }

      return okCheck(
        id,
        title,
        nonEmptyDetail(data.message, 'Address verified in county parcel records.'),
        data.parcel ? `APN: ${data.parcel.apn}` : null,
      );
    },
  );
}

/**
 * Normalizes assessor zoning and land-use worker output into a standard CheckResult.
 *
 * @param landUse Raw land use evaluation result or worker failure fallback.
 * @returns Normalized land use CheckResult.
 */
function normalizeLandUse(landUse: RawChecks['landUse']): CheckResult {
  const id = 'landUse';
  const title = 'Zoning and Land Use Compliance';

  return normalizeEnvelopeCheck(
    landUse,
    id,
    title,
    {
      workerFailureDetail:
        'Zoning and land use check could not be completed due to worker failure.',
      invalidInputDetail: 'Invalid land use input parameters.',
      skippedDetail: 'Land use information not specified; check skipped.',
    },
    (data) => {
      const evidence = data.category ? `Category: ${data.category}` : null;

      if (
        data.status === 'violation' ||
        data.status === 'warning' ||
        data.flag === 'NON_RESIDENTIAL_LAND_USE' ||
        data.flag === 'VACANT_OR_UNBUILT_PARCEL'
      ) {
        return flagCheck(
          id,
          title,
          POINTS_LAND_USE_MISMATCH,
          nonEmptyDetail(
            data.message,
            'Property zoning does not match standard residential living.',
          ),
          evidence,
        );
      }

      return okCheck(
        id,
        title,
        nonEmptyDetail(data.message, 'Complies with lawful residential land use.'),
        evidence,
      );
    },
  );
}

/**
 * Normalizes contact phone area code worker output into a standard CheckResult.
 *
 * @param phone Raw phone verification result or worker failure fallback.
 * @returns Normalized contact phone CheckResult.
 */
function normalizeContactPhone(phone: RawChecks['contactPhone']): CheckResult {
  const id = 'contactPhone';
  const title = 'Contact Phone Verification';

  return normalizeEnvelopeCheck(
    phone,
    id,
    title,
    {
      workerFailureDetail:
        'Contact phone verification could not be completed due to worker failure.',
      invalidInputDetail: 'Invalid contact phone input parameters.',
      skippedDetail: 'Contact phone number not specified; check skipped.',
    },
    (data) => {
      const evidence = data.areaCode ? `Area code: ${data.areaCode}` : null;

      if (data.flag === 'OBFUSCATED_PHONE_NUMBER') {
        return flagCheck(
          id,
          title,
          POINTS_OBFUSCATED_CONTACT,
          nonEmptyDetail(
            data.message,
            'Suspicious obfuscated contact details detected in description.',
          ),
          evidence,
        );
      }

      if (
        data.flag === 'NON_LOCAL_AREA_CODE' ||
        data.flag === 'INTERNATIONAL_PHONE_NUMBER' ||
        data.status === 'warning'
      ) {
        return flagCheck(
          id,
          title,
          POINTS_NON_LOCAL_PHONE,
          nonEmptyDetail(data.message, 'Contact phone area code or country prefix is non-local.'),
          evidence,
        );
      }

      return okCheck(
        id,
        title,
        nonEmptyDetail(data.message, 'Phone number verified with regional or commercial prefix.'),
        evidence,
      );
    },
  );
}

/**
 * Normalizes landlord or agency corporate standing worker output into a standard CheckResult.
 *
 * @param agency Raw agency registry verification result or worker failure fallback.
 * @returns Normalized agency standing CheckResult.
 */
function normalizeAgencyStanding(agency: RawChecks['agencyStanding']): CheckResult {
  const id = 'agencyStanding';
  const title = 'Rental Agency Business Registry';

  if (!agency || isWorkerFailure(agency)) {
    return unknownCheck(
      id,
      title,
      'Agency business registry verification could not be completed due to worker failure.',
    );
  }

  if (agency.status === 'skipped') {
    return skippedCheck(
      id,
      title,
      nonEmptyDetail(agency.message, 'Landlord or rental agency not specified; check skipped.'),
    );
  }

  if (agency.flag === 'SUSPENDED_ENTITY') {
    return flagCheck(
      id,
      title,
      POINTS_SUSPENDED_ENTITY,
      nonEmptyDetail(
        agency.message,
        'Rental entity is suspended or inactive in corporate registry.',
      ),
    );
  }

  if (agency.flag === 'UNREGISTERED_ENTITY' || agency.status === 'warning') {
    return flagCheck(
      id,
      title,
      POINTS_UNREGISTERED_ENTITY,
      nonEmptyDetail(
        agency.message,
        'Rental agency could not be verified in corporate business registry.',
      ),
    );
  }

  return okCheck(
    id,
    title,
    nonEmptyDetail(agency.message, 'Entity verified in active corporate business registry.'),
  );
}

/**
 * Normalizes duplicate listing search worker output into a standard CheckResult.
 *
 * @param search Raw duplicate listing search result or worker failure fallback.
 * @returns Normalized duplicate listing search CheckResult.
 */
function normalizeListingSearch(search: RawChecks['listingSearch']): CheckResult {
  const id = 'listingSearch';
  const title = 'Cross-Platform Duplicate Detection';

  if (!search || isWorkerFailure(search)) {
    return unknownCheck(
      id,
      title,
      'Duplicate listing search could not be completed due to worker failure.',
    );
  }

  if (search.matches.length > 0) {
    const urls = search.matches
      .map((m: ListingMatch) => m.url)
      .filter(Boolean)
      .join(', ');

    return flagCheck(
      id,
      title,
      POINTS_DUPLICATE_MISMATCH,
      'Cross-platform duplicate listing match detected on other rental platforms.',
      urls || null,
    );
  }

  const uniqueFailedSources = [...new Set(search.failedSources)];
  if (uniqueFailedSources.length >= LISTING_SEARCH_SOURCE_COUNT) {
    return unknownCheck(id, title, 'External duplicate search providers were unavailable.');
  }

  if (uniqueFailedSources.length > 0) {
    return okCheck(
      id,
      title,
      'No duplicate listings detected on available sources ' +
        `(unavailable providers: ${uniqueFailedSources.join(', ')}).`,
    );
  }

  return okCheck(id, title, 'No duplicate listings detected on other rental platforms.');
}

/**
 * Generates an informative narrative summary for an evaluated listing based on composite score.
 *
 * @param score Capped risk score.
 * @param rating Evaluated risk tier (LOW, MEDIUM, or HIGH).
 * @returns Human-readable summary string.
 */
function generateSummary(score: number, rating: Exclude<RiskRating, 'INSUFFICIENT_DATA'>): string {
  switch (rating) {
    case 'HIGH': {
      return (
        `High risk (${score}/100): multiple critical warning flags or statutory violations ` +
        'detected. Exercise extreme caution before proceeding.'
      );
    }
    case 'MEDIUM': {
      return (
        `Moderate risk (${score}/100): potential irregularities or non-standard terms detected. ` +
        'Review flagged items carefully.'
      );
    }
    case 'LOW': {
      return (
        `Low risk (${score}/100): evaluated listing details comply with standard rental ` +
        'regulations with zero critical red flags.'
      );
    }
  }
}

/**
 * Deterministically evaluates aggregated raw worker outputs and computes the composite risk score.
 *
 * - Normalizes all 9 worker outputs into standardized CheckResult items.
 * - Handles the insufficient data edge case when fewer than 3 checks have evaluable data.
 * - Computes composite point accumulation capped between 0 and 100.
 * - Categorizes listings into LOW (0-39), MEDIUM (40-69), or HIGH (70-100) risk tiers.
 *
 * @param rawChecks Aggregated worker outputs from evaluateOrchestrator.
 * @returns Composite ScoreResult with score, rating, summary, and normalized checks.
 */
export function calculateListingScore(rawChecks: RawChecks): ScoreResult {
  const checks: CheckResult[] = [
    normalizePrice(rawChecks.price),
    normalizeSecurityDeposit(rawChecks.securityDeposit),
    normalizeApplicationFee(rawChecks.applicationFee),
    normalizePayment(rawChecks.untraceablePayment),
    normalizeGisQuery(rawChecks.gisQuery),
    normalizeLandUse(rawChecks.landUse),
    normalizeContactPhone(rawChecks.contactPhone),
    normalizeAgencyStanding(rawChecks.agencyStanding),
    normalizeListingSearch(rawChecks.listingSearch),
  ];

  let evaluatedCount = 0;
  let totalPoints = 0;
  for (const check of checks) {
    if (check.status === 'OK' || check.status === 'FLAG') {
      evaluatedCount += 1;
    }
    totalPoints += check.scoreImpact;
  }

  if (evaluatedCount < MIN_EVALUATED_CHECKS_THRESHOLD) {
    return {
      score: null,
      rating: 'INSUFFICIENT_DATA',
      summary: INSUFFICIENT_DATA_SUMMARY,
      checks,
    };
  }

  const score = Math.min(100, Math.max(0, totalPoints));

  let rating: Exclude<RiskRating, 'INSUFFICIENT_DATA'> = 'LOW';
  if (score >= 70) {
    rating = 'HIGH';
  } else if (score >= 40) {
    rating = 'MEDIUM';
  }

  return {
    score,
    rating,
    summary: generateSummary(score, rating),
    checks,
  };
}
