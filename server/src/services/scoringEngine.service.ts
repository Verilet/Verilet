import type { RawChecks, WorkerFailureFallback } from '../schemas/evaluate.schema.js';
import { isP2pPaymentMethod } from './paymentFlags.service.js';

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
  /** Matched evidence string, citation, or key triggering the finding, or null when absent. */
  readonly evidence: string | null;
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

/** Minimum composite score bound. */
const MIN_SCORE = 0;

/** Maximum composite score bound. */
const MAX_SCORE = 100;

/** Minimum score classified as HIGH risk. */
const HIGH_RISK_SCORE_THRESHOLD = 70;

/** Minimum score classified as MEDIUM risk. */
const MEDIUM_RISK_SCORE_THRESHOLD = 40;

/** Percentage-of-baseline cutoff below which rent is flagged as a severe outlier. */
const RENT_SEVERE_PERCENT_THRESHOLD = 50;

/** Percentage-of-baseline cutoff at or below which rent is flagged as a moderate outlier. */
const RENT_MODERATE_PERCENT_THRESHOLD = 75;

/** Number of cross-platform duplicate search providers ('address' and 'photo'). */
const LISTING_SEARCH_SOURCE_COUNT = 2;

/** Standard explanation returned when listing has insufficient evaluable data. */
export const INSUFFICIENT_DATA_SUMMARY =
  'Could not evaluate listing due to insufficient data. Please add details to calculate risk.';

/** Standard success/failure envelope shape shared by evaluation worker services. */
type WorkerEnvelope<Data> =
  | { readonly success: true; readonly data: Data }
  | { readonly success: false; readonly error: string };

/** Minimum payload structure shared by envelope-based evaluation workers. */
interface WorkerCheckData {
  /** Raw worker status string (e.g., 'compliant', 'warning', 'violation', 'skipped'). */
  readonly status: string;
  /** Optional human-readable explanation returned by the worker. */
  readonly message?: string;
}

/** Default messages used when unwrapping standard worker envelopes. */
interface EnvelopeFallbackMessages {
  readonly workerFailureDetail: string;
  readonly invalidInputDetail: string;
  readonly skippedDetail: string;
}

/** Bound CheckResult factory helpers scoped to a single check's id and title. */
interface CheckBuilder {
  /** Creates an UNKNOWN CheckResult with 0 score impact. */
  readonly unknown: (detail: string) => CheckResult;
  /** Creates a SKIPPED CheckResult with 0 score impact. */
  readonly skipped: (detail: string) => CheckResult;
  /** Creates an OK CheckResult with 0 score impact. */
  readonly ok: (detail: string, evidence?: string | null) => CheckResult;
  /** Creates a FLAG CheckResult with positive score impact. */
  readonly flag: (scoreImpact: number, detail: string, evidence?: string | null) => CheckResult;
}

/** Configuration object for normalizing an envelope-based worker output. */
interface NormalizeEnvelopeParams<Data extends WorkerCheckData> {
  readonly raw: WorkerEnvelope<Data> | WorkerFailureFallback;
  readonly builder: CheckBuilder;
  readonly defaults: EnvelopeFallbackMessages;
  readonly mapData: (data: Data, check: CheckBuilder) => CheckResult;
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
 *
 * @param message Raw message string from a worker service.
 * @param fallback Default explanation to use when message is blank or missing.
 * @returns Non-empty explanation string.
 */
function nonEmptyDetail(message: string | null | undefined, fallback: string): string {
  const trimmed = message?.trim();
  return trimmed ? trimmed : fallback;
}

/**
 * Creates bound CheckResult factory methods for a specific diagnostic check id and title.
 *
 * @param id Unique diagnostic check identifier.
 * @param title Human-readable check label.
 * @returns CheckBuilder scoped to the given id and title.
 */
function createCheckBuilder(id: string, title: string): CheckBuilder {
  const build = (
    status: CheckStatus,
    scoreImpact: number,
    detail: string,
    evidence: string | null = null,
  ): CheckResult => ({ id, title, status, scoreImpact, detail, evidence });

  return {
    unknown: (detail: string) => build('UNKNOWN', 0, detail, null),
    skipped: (detail: string) => build('SKIPPED', 0, detail, null),
    ok: (detail: string, evidence: string | null = null) => build('OK', 0, detail, evidence),
    flag: (scoreImpact: number, detail: string, evidence: string | null = null) =>
      build('FLAG', scoreImpact, detail, evidence),
  };
}

/**
 * Handles common worker-failure, invalid-input, and skipped states for envelope-based workers
 * before delegating active findings to the check-specific mapper.
 *
 * @param params Envelope normalization configuration including raw output, builder, and mapper.
 * @returns Normalized CheckResult for the envelope worker.
 */
function normalizeEnvelopeCheck<Data extends WorkerCheckData>({
  raw,
  builder,
  defaults,
  mapData,
}: NormalizeEnvelopeParams<Data>): CheckResult {
  if (!raw || isWorkerFailure(raw)) {
    return builder.unknown(defaults.workerFailureDetail);
  }
  if (!raw.success) {
    return builder.unknown(nonEmptyDetail(raw.error, defaults.invalidInputDetail));
  }
  if (raw.data.status === 'skipped') {
    return builder.skipped(nonEmptyDetail(raw.data.message, defaults.skippedDetail));
  }
  return mapData(raw.data, builder);
}

/**
 * Builds a fallback price explanation when the price worker provides an empty explanation.
 *
 * @param rent Listing monthly rent amount.
 * @param baseline Regional baseline average rent, or null if unavailable.
 * @param severityLabel Severity descriptor for how far below baseline the rent falls.
 * @returns Human-readable fallback price explanation.
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
  const check = createCheckBuilder('price', 'Price Baseline Comparison');

  if (!price || isWorkerFailure(price)) {
    return check.unknown('Price evaluation could not be completed due to worker failure.');
  }

  if (price.status === 'not_evaluated') {
    return check.unknown(
      nonEmptyDetail(
        price.explanation,
        'No regional baseline price data found for comparison in this space type or location.',
      ),
    );
  }

  const percent = price.percentOfBaseline;
  const evidence = percent != null ? `${percent}% of baseline` : null;

  if (
    price.status === 'violation' ||
    (percent != null && percent < RENT_SEVERE_PERCENT_THRESHOLD)
  ) {
    return check.flag(
      POINTS_RENT_UNDER_50,
      nonEmptyDetail(
        price.explanation,
        buildPriceFallbackDetail(price.rent, price.baseline, 'severely'),
      ),
      evidence,
    );
  }

  if (percent == null) {
    return check.unknown(
      nonEmptyDetail(price.explanation, 'Price baseline comparison percentage is unavailable.'),
    );
  }

  if (percent <= RENT_MODERATE_PERCENT_THRESHOLD) {
    return check.flag(
      POINTS_RENT_UNDER_75,
      nonEmptyDetail(
        price.explanation,
        buildPriceFallbackDetail(price.rent, price.baseline, 'moderately'),
      ),
      evidence,
    );
  }

  return check.ok(
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
  return normalizeEnvelopeCheck({
    raw: deposit,
    builder: createCheckBuilder('securityDeposit', 'Security Deposit Legal Cap'),
    defaults: {
      workerFailureDetail: 'Security deposit check could not be completed due to worker failure.',
      invalidInputDetail: 'Invalid security deposit input parameters.',
      skippedDetail: 'Security deposit not specified; check skipped.',
    },
    mapData: (data, check) => {
      const citation = data.statutoryCitation ?? null;

      if (data.status === 'violation' || data.flag === 'ILLEGAL_SECURITY_DEPOSIT') {
        return check.flag(
          POINTS_DEPOSIT_OVER_2X,
          nonEmptyDetail(
            data.message,
            'Security deposit exceeds California statutory 2x rent cap.',
          ),
          citation,
        );
      }

      if (data.status === 'warning' || data.flag === 'EXCEEDS_STANDARD_DEPOSIT_CAP') {
        return check.flag(
          POINTS_DEPOSIT_OVER_1X,
          nonEmptyDetail(data.message, 'Security deposit exceeds standard California 1x rent cap.'),
          citation,
        );
      }

      if (data.status === 'compliant') {
        return check.ok(
          nonEmptyDetail(
            data.message,
            'Security deposit complies with California AB 12 statutory cap.',
          ),
          citation,
        );
      }

      return check.unknown(
        nonEmptyDetail(data.message, 'Security deposit check returned an unrecognized status.'),
      );
    },
  });
}

/**
 * Normalizes application screening fee worker output into a standard CheckResult.
 *
 * @param fee Raw output from application screening fee worker or fallback.
 * @returns Normalized application fee CheckResult.
 */
function normalizeApplicationFee(fee: RawChecks['applicationFee']): CheckResult {
  return normalizeEnvelopeCheck({
    raw: fee,
    builder: createCheckBuilder('applicationFee', 'Application Screening Fee Cap'),
    defaults: {
      workerFailureDetail: 'Application fee check could not be completed due to worker failure.',
      invalidInputDetail: 'Invalid application fee input parameters.',
      skippedDetail: 'Application fee not specified; check skipped.',
    },
    mapData: (data, check) => {
      const citation = data.statutoryCitation ?? null;

      if (data.status === 'violation' || data.flag === 'EXCESSIVE_APPLICATION_FEE') {
        return check.flag(
          POINTS_EXCESSIVE_FEE,
          nonEmptyDetail(data.message, 'Application screening fee exceeds statutory limit.'),
          citation,
        );
      }

      if (data.status === 'compliant') {
        return check.ok(
          nonEmptyDetail(
            data.message,
            'Application screening fee complies with California statutory limits.',
          ),
          citation,
        );
      }

      return check.unknown(
        nonEmptyDetail(data.message, 'Application fee check returned an unrecognized status.'),
      );
    },
  });
}

/**
 * Normalizes untraceable and advance fee payment worker output into a standard CheckResult.
 *
 * @param payment Raw payment violation array or worker failure fallback.
 * @returns Normalized payment method CheckResult.
 */
function normalizePayment(payment: RawChecks['untraceablePayment']): CheckResult {
  const check = createCheckBuilder('untraceablePayment', 'Payment Method Security');

  if (!payment || isWorkerFailure(payment) || !Array.isArray(payment)) {
    return check.unknown('Payment risk check could not be completed due to worker failure.');
  }

  if (payment.length === 0) {
    return check.ok('No high-risk or untraceable payment demands detected.');
  }

  // Cap each payment risk category once; delegate P2P vs untraceable classification to paymentFlags.
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
        if (isP2pPaymentMethod(violation.evidence)) {
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
    return check.unknown('Payment risk check returned unrecognized violation data.');
  }

  const detail = [...titles].join(' ') || 'High-risk or untraceable payment method detected.';

  return check.flag(points, detail, [...evidences].join(', ') || null);
}

/**
 * Normalizes county GIS assessor parcel query worker output into a standard CheckResult.
 *
 * @param gis Raw GIS assessor query output or worker failure fallback.
 * @returns Normalized GIS query CheckResult.
 */
function normalizeGisQuery(gis: RawChecks['gisQuery']): CheckResult {
  const check = createCheckBuilder('gisQuery', 'County GIS Property Records');

  if (gis && !isWorkerFailure(gis) && gis.success && gis.data.flag === 'GIS_SERVICE_UNAVAILABLE') {
    return check.unknown(
      nonEmptyDetail(gis.data.message, 'County GIS service timed out or is currently unavailable.'),
    );
  }

  return normalizeEnvelopeCheck({
    raw: gis,
    builder: check,
    defaults: {
      workerFailureDetail:
        'County GIS property check could not be completed due to worker failure.',
      invalidInputDetail: 'Invalid address for county GIS verification.',
      skippedDetail: 'Address not specified; check skipped.',
    },
    mapData: (data, activeCheck) => {
      if (data.flag === 'UNVERIFIED_ADDRESS' || data.status === 'warning') {
        return activeCheck.flag(
          POINTS_UNVERIFIED_ADDRESS,
          nonEmptyDetail(
            data.message,
            'Address could not be verified in county assessor parcel records.',
          ),
        );
      }

      if (data.status === 'compliant') {
        const apn = data.parcel?.apn.trim();
        return activeCheck.ok(
          nonEmptyDetail(data.message, 'Address verified in county parcel records.'),
          apn ? `APN: ${apn}` : null,
        );
      }

      return activeCheck.unknown(
        nonEmptyDetail(data.message, 'County GIS check returned an unrecognized status.'),
      );
    },
  });
}

/**
 * Normalizes assessor zoning and land-use worker output into a standard CheckResult.
 *
 * @param landUse Raw land use evaluation result or worker failure fallback.
 * @returns Normalized land use CheckResult.
 */
function normalizeLandUse(landUse: RawChecks['landUse']): CheckResult {
  return normalizeEnvelopeCheck({
    raw: landUse,
    builder: createCheckBuilder('landUse', 'Zoning and Land Use Compliance'),
    defaults: {
      workerFailureDetail:
        'Zoning and land use check could not be completed due to worker failure.',
      invalidInputDetail: 'Invalid land use input parameters.',
      skippedDetail: 'Land use information not specified; check skipped.',
    },
    mapData: (data, check) => {
      const evidence = data.category ? `Category: ${data.category}` : null;

      if (
        data.status === 'violation' ||
        data.status === 'warning' ||
        data.flag === 'NON_RESIDENTIAL_LAND_USE' ||
        data.flag === 'VACANT_OR_UNBUILT_PARCEL'
      ) {
        return check.flag(
          POINTS_LAND_USE_MISMATCH,
          nonEmptyDetail(
            data.message,
            'Property zoning does not match standard residential living.',
          ),
          evidence,
        );
      }

      if (data.status === 'compliant') {
        return check.ok(
          nonEmptyDetail(data.message, 'Complies with lawful residential land use.'),
          evidence,
        );
      }

      return check.unknown(
        nonEmptyDetail(data.message, 'Land use check returned an unrecognized status.'),
      );
    },
  });
}

/**
 * Normalizes contact phone area code worker output into a standard CheckResult.
 *
 * @param phone Raw phone verification result or worker failure fallback.
 * @returns Normalized contact phone CheckResult.
 */
function normalizeContactPhone(phone: RawChecks['contactPhone']): CheckResult {
  return normalizeEnvelopeCheck({
    raw: phone,
    builder: createCheckBuilder('contactPhone', 'Contact Phone Verification'),
    defaults: {
      workerFailureDetail:
        'Contact phone verification could not be completed due to worker failure.',
      invalidInputDetail: 'Invalid contact phone input parameters.',
      skippedDetail: 'Contact phone number not specified; check skipped.',
    },
    mapData: (data, check) => {
      const evidence = data.areaCode ? `Area code: ${data.areaCode}` : null;

      if (data.flag === 'OBFUSCATED_PHONE_NUMBER') {
        return check.flag(
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
        return check.flag(
          POINTS_NON_LOCAL_PHONE,
          nonEmptyDetail(data.message, 'Contact phone area code or country prefix is non-local.'),
          evidence,
        );
      }

      if (data.status === 'compliant') {
        return check.ok(
          nonEmptyDetail(data.message, 'Phone number verified with regional or commercial prefix.'),
          evidence,
        );
      }

      return check.unknown(
        nonEmptyDetail(data.message, 'Contact phone check returned an unrecognized status.'),
      );
    },
  });
}

/**
 * Normalizes landlord or agency corporate standing worker output into a standard CheckResult.
 *
 * @param agency Raw agency registry verification result or worker failure fallback.
 * @returns Normalized agency standing CheckResult.
 */
function normalizeAgencyStanding(agency: RawChecks['agencyStanding']): CheckResult {
  const check = createCheckBuilder('agencyStanding', 'Rental Agency Business Registry');

  if (!agency || isWorkerFailure(agency)) {
    return check.unknown(
      'Agency business registry verification could not be completed due to worker failure.',
    );
  }

  if (agency.status === 'skipped') {
    return check.skipped(
      nonEmptyDetail(agency.message, 'Landlord or rental agency not specified; check skipped.'),
    );
  }

  if (agency.flag === 'SUSPENDED_ENTITY') {
    return check.flag(
      POINTS_SUSPENDED_ENTITY,
      nonEmptyDetail(
        agency.message,
        'Rental entity is suspended or inactive in corporate registry.',
      ),
    );
  }

  if (agency.flag === 'UNREGISTERED_ENTITY' || agency.status === 'warning') {
    return check.flag(
      POINTS_UNREGISTERED_ENTITY,
      nonEmptyDetail(
        agency.message,
        'Rental agency could not be verified in corporate business registry.',
      ),
    );
  }

  if (agency.status === 'compliant') {
    return check.ok(
      nonEmptyDetail(agency.message, 'Entity verified in active corporate business registry.'),
    );
  }

  return check.unknown(
    nonEmptyDetail(agency.message, 'Agency business registry returned an unrecognized status.'),
  );
}

/**
 * Normalizes duplicate listing search worker output into a standard CheckResult.
 *
 * @param search Raw duplicate listing search result or worker failure fallback.
 * @returns Normalized duplicate listing search CheckResult.
 */
function normalizeListingSearch(search: RawChecks['listingSearch']): CheckResult {
  const check = createCheckBuilder('listingSearch', 'Cross-Platform Duplicate Detection');

  if (
    !search ||
    isWorkerFailure(search) ||
    !Array.isArray(search.matches) ||
    !Array.isArray(search.failedSources)
  ) {
    return check.unknown('Duplicate listing search could not be completed due to worker failure.');
  }

  if (search.status === 'skipped') {
    return check.skipped(
      nonEmptyDetail(search.message, 'Cross-platform duplicate listing search skipped.'),
    );
  }

  const urls = search.matches
    .map((match) => match.url)
    .filter(Boolean)
    .join(', ');

  if (
    search.flag === 'DUPLICATE_LISTING_MISMATCH' ||
    search.status === 'violation' ||
    search.status === 'warning'
  ) {
    return check.flag(
      POINTS_DUPLICATE_MISMATCH,
      nonEmptyDetail(
        search.message,
        'Cross-platform duplicate listing mismatch detected (significant differences in rent or contact info).',
      ),
      urls || null,
    );
  }

  if (search.matches.length > 0) {
    return check.ok(
      nonEmptyDetail(
        search.message,
        'Cross-platform duplicate listings found with consistent listing details.',
      ),
      urls || null,
    );
  }

  if (search.status === 'compliant') {
    return check.ok(
      nonEmptyDetail(search.message, 'No duplicate listings detected on other rental platforms.'),
    );
  }

  const uniqueFailedSources = [...new Set(search.failedSources)];
  if (uniqueFailedSources.length >= LISTING_SEARCH_SOURCE_COUNT) {
    return check.unknown('External duplicate search providers were unavailable.');
  }

  if (uniqueFailedSources.length > 0) {
    return check.ok(
      'No duplicate listings detected on available sources ' +
        `(unavailable providers: ${uniqueFailedSources.join(', ')}).`,
    );
  }

  return check.ok('No duplicate listings detected on other rental platforms.');
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

  const score = Math.min(MAX_SCORE, Math.max(MIN_SCORE, totalPoints));

  let rating: Exclude<RiskRating, 'INSUFFICIENT_DATA'> = 'LOW';
  if (score >= HIGH_RISK_SCORE_THRESHOLD) {
    rating = 'HIGH';
  } else if (score >= MEDIUM_RISK_SCORE_THRESHOLD) {
    rating = 'MEDIUM';
  }

  return {
    score,
    rating,
    summary: generateSummary(score, rating),
    checks,
  };
}
