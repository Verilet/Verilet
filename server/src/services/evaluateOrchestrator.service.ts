import {
  type BedroomValue,
  type EvaluateRequest,
  type EvaluateResponse,
  type PaymentValue,
  type WorkerFailureFallback,
} from '../schemas/evaluate.schema.js';
import { checkPrice, type SpaceType } from './checkers/averagePrice.service.js';
import { evaluateSecurityDeposit } from './securityDeposit.service.js';
import { evaluateApplicationFee } from './applicationFee.service.js';
import {
  detectUntraceablePayment,
  detectAdvanceFee,
  detectHighRiskSelections,
} from './paymentFlags.service.js';
import { evaluateGisQuery } from './gisQuery.service.js';
import { evaluateLandUse } from './landUse.service.js';
import { evaluatePhoneAreaCode } from './phoneFlags.service.js';
import { verifyAgencyStanding } from './agencyVerification.service.js';
import { listingSearch } from './listingSearch.service.js';

/** Default maximum time in milliseconds allowed for an individual worker before timing out. */
export const WORKER_TIMEOUT_MS = 5000;

/** Standard fallback returned when an individual worker promise rejects or times out. */
export const WORKER_FAILED_FALLBACK: WorkerFailureFallback = Object.freeze({
  status: 'skipped' as const,
  flag: null,
  error: 'WORKER_FAILED' as const,
});

/**
 * Maps a listing form bedroom selection to an average price checker SpaceType.
 *
 * @param bedrooms Form bedroom selection
 * @returns Compatible space type string for baseline price comparison
 */
export function mapBedroomsToSpaceType(bedrooms: BedroomValue): SpaceType {
  switch (bedrooms) {
    case 'room': {
      return 'single_room';
    }
    case 'studio': {
      return 'studio';
    }
    case '1': {
      return '1br';
    }
    case '2': {
      return '2br';
    }
    case '3': {
      return '3br';
    }
    case '4+': {
      return '4br';
    }
    default: {
      return 'single_room';
    }
  }
}

/**
 * Maps the request's payment selection enum to terms recognized by detectHighRiskSelections.
 *
 * @param payment Optional selected payment method from EvaluateRequest
 * @returns Array of payment method tokens for high-risk selection detection
 */
export function mapPaymentToSelections(payment?: PaymentValue | null): string[] {
  if (!payment) {
    return [];
  }
  if (payment === 'wire') {
    return ['wire_transfer'];
  }
  if (payment === 'zelle-venmo') {
    return ['zelle', 'venmo'];
  }
  return [payment];
}

/**
 * Extracts a 5-digit US ZIP code from an address/location string if present.
 * Looks for postal code preceded by state or located at the end of the address.
 *
 * @param location Freeform address string
 * @returns 5-digit zip string, or undefined if not found
 */
export function extractZip(location: string): string | undefined {
  const zipAfterState = location.match(/\b(?:[A-Z]{2}|California)\s*,?\s*(\d{5})(?:-\d{4})?\b/i);
  if (zipAfterState) {
    return zipAfterState[1];
  }
  const trailingZip = location.match(/\b(\d{5})(?:-\d{4})?\b\s*$/);
  if (trailingZip) {
    return trailingZip[1];
  }
  return undefined;
}

/**
 * Wraps a worker function invocation with an explicit timeout.
 * Rejects if the worker throws synchronously, rejects asynchronously, or exceeds timeoutMs.
 *
 * @param action Function returning a promise or value
 * @param timeoutMs Maximum execution window in milliseconds
 * @returns Promise resolving to the worker output
 */
export async function withTimeout<T>(
  action: () => Promise<T> | T,
  timeoutMs = WORKER_TIMEOUT_MS,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('WORKER_TIMEOUT'));
    }, timeoutMs);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  });

  const actionPromise = Promise.resolve().then(() => action());
  // Prevent unhandled rejections if actionPromise rejects after the timeout window
  actionPromise.catch(() => {});

  try {
    return await Promise.race([actionPromise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/**
 * Normalizes a settled promise result. Returns the fulfilled value or the fallback object.
 *
 * @param result Settled promise result from Promise.allSettled()
 * @returns Worker output if fulfilled, or WORKER_FAILED_FALLBACK if rejected
 */
export function normalizeSettledResult<T>(
  result: PromiseSettledResult<T>,
): T | WorkerFailureFallback {
  if (result.status === 'fulfilled') {
    return result.value;
  }
  return WORKER_FAILED_FALLBACK;
}

/** Options for controlling evaluation orchestration behavior. */
export interface OrchestratorOptions {
  /** Maximum execution window for workers before timing out (defaults to 5000ms). */
  workerTimeoutMs?: number;
}

/**
 * Orchestrates full listing evaluation by executing all 9 independent verification workers
 * concurrently using Promise.allSettled().
 *
 * Isolates individual worker failures and timeouts, guaranteeing a successful overall envelope
 * while marking affected checks as skipped.
 *
 * @param input Validated listing payload
 * @param options Optional orchestration options such as workerTimeoutMs
 * @returns Standard evaluation response envelope containing rawChecks dictionary
 */
export async function orchestrateEvaluation(
  input: EvaluateRequest,
  options?: OrchestratorOptions,
): Promise<EvaluateResponse> {
  const defaultTimeoutMs = Number(process.env.EVALUATE_WORKER_TIMEOUT_MS) || WORKER_TIMEOUT_MS;
  const timeoutMs = options?.workerTimeoutMs ?? defaultTimeoutMs;

  const pricePromise = withTimeout(
    () =>
      checkPrice({
        rent: input.rent,
        spaceType: mapBedroomsToSpaceType(input.bedrooms),
        zip: extractZip(input.location),
      }),
    timeoutMs,
  );

  const securityDepositPromise = withTimeout(
    () =>
      evaluateSecurityDeposit({
        rent: input.rent,
        deposit: input.securityDeposit,
      }),
    timeoutMs,
  );

  const applicationFeePromise = withTimeout(
    () =>
      evaluateApplicationFee({
        applicationFee: input.applicationFee,
      }),
    timeoutMs,
  );

  const untraceablePaymentPromise = withTimeout(
    () => [
      ...detectUntraceablePayment(input.description),
      ...detectAdvanceFee(input.description),
      ...detectHighRiskSelections(mapPaymentToSelections(input.payment)),
    ],
    timeoutMs,
  );

  const gisQueryPromise = withTimeout(
    () =>
      evaluateGisQuery({
        address: input.location,
      }),
    timeoutMs,
  );

  const landUsePromise = withTimeout(async () => {
    let parcel = null;
    try {
      const gisResult = await gisQueryPromise;
      if (gisResult?.success && gisResult.data.parcel) {
        parcel = gisResult.data.parcel;
      }
    } catch {
      // If GIS service throws or times out, proceed with null parcel so land-use skips cleanly.
    }

    return evaluateLandUse({
      useCode: parcel?.useCode ?? null,
      useDescription: parcel?.useDescription ?? null,
    });
  }, timeoutMs);

  const contactPhonePromise = withTimeout(
    () => evaluatePhoneAreaCode(input.contactPhone),
    timeoutMs,
  );

  const agencyStandingPromise = withTimeout(() => verifyAgencyStanding(input.landlord), timeoutMs);

  const listingSearchPromise = withTimeout(() => listingSearch(input), timeoutMs);

  const [
    priceResult,
    securityDepositResult,
    applicationFeeResult,
    untraceablePaymentResult,
    gisQueryResult,
    landUseResult,
    contactPhoneResult,
    agencyStandingResult,
    listingSearchResult,
  ] = await Promise.allSettled([
    pricePromise,
    securityDepositPromise,
    applicationFeePromise,
    untraceablePaymentPromise,
    gisQueryPromise,
    landUsePromise,
    contactPhonePromise,
    agencyStandingPromise,
    listingSearchPromise,
  ]);

  return {
    success: true,
    data: {
      rawChecks: {
        price: normalizeSettledResult(priceResult),
        securityDeposit: normalizeSettledResult(securityDepositResult),
        applicationFee: normalizeSettledResult(applicationFeeResult),
        untraceablePayment: normalizeSettledResult(untraceablePaymentResult),
        gisQuery: normalizeSettledResult(gisQueryResult),
        landUse: normalizeSettledResult(landUseResult),
        contactPhone: normalizeSettledResult(contactPhoneResult),
        agencyStanding: normalizeSettledResult(agencyStandingResult),
        listingSearch: normalizeSettledResult(listingSearchResult),
      },
    },
  };
}
