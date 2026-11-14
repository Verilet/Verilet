import { z } from 'zod';

/** Legal citations under California Civil Code § 1950.6. */
const CITATION_STANDARD = 'Cal. Civ. Code § 1950.6';
const CITATION_VIOLATION = 'Cal. Civ. Code § 1950.6(b)';

/** Baseline statutory maximum application screening fee under California Civil Code § 1950.6. */
export const DEFAULT_MAX_APPLICATION_FEE = 65;

/** Zod schema for inputs for California application fee evaluation. */
export const ApplicationFeeInputSchema = z.object({
  /** Requested application fee amount in USD, or null/undefined if unspecified. */
  applicationFee: z.number().min(0).finite().nullish(),
});

/** Input payload for application fee evaluation. */
export type ApplicationFeeInput = z.infer<typeof ApplicationFeeInputSchema>;

/** Zod schema for options configuring statutory evaluation parameters. */
export const ApplicationFeeOptionsSchema = z.object({
  /** Custom statutory maximum fee cap for future adjustments or overrides. */
  maxFee: z.number().min(0).finite().optional(),
});

/** Options configuring statutory fee limits. */
export type ApplicationFeeOptions = z.infer<typeof ApplicationFeeOptionsSchema>;

/** Compliance status under California tenancy law. */
export type ApplicationFeeStatus = 'compliant' | 'violation' | 'skipped';

/** Risk and violation flags for application fee evaluation. */
export type ApplicationFeeFlag = 'EXCESSIVE_APPLICATION_FEE';

/** Financial evaluation result payload. */
export interface ApplicationFeeData {
  /** Compliance status classification. */
  readonly status: ApplicationFeeStatus;
  /** Violation or warning flag, or null if compliant/skipped. */
  readonly flag: ApplicationFeeFlag | null;
  /** Human-readable explanatory message explaining statutory finding. */
  readonly message: string;
  /** Legal citation or null if skipped. */
  readonly statutoryCitation: string | null;
}

/** JSON envelope returned by the application fee evaluation service. */
export type ApplicationFeeResult =
  | {
      /** Whether the evaluation completed without fatal input errors. */
      readonly success: true;
      /** Application fee findings and flags. */
      readonly data: ApplicationFeeData;
    }
  | {
      /** Indicates evaluation could not be performed due to invalid input. */
      readonly success: false;
      /** Error message describing validation failure. */
      readonly error: string;
      /** Optional detail message describing validation issue. */
      readonly details?: string;
    };

/** Evaluation envelope returned when application fee is unpopulated or omitted. */
const SKIPPED_RESULT: ApplicationFeeResult = Object.freeze({
  success: true,
  data: Object.freeze({
    status: 'skipped',
    flag: null,
    message: 'Application fee not specified; check skipped',
    statutoryCitation: null,
  }),
});

/**
 * Evaluates requested application screening fee against California Civil Code § 1950.6.
 *
 * @param input Financial input containing applicationFee.
 * @param options Optional configuration specifying custom statutory cap for future flexibility.
 * @return Evaluation envelope
 */
export function evaluateApplicationFee(
  input?: ApplicationFeeInput | null,
  options?: ApplicationFeeOptions | null,
): ApplicationFeeResult {
  // Guard against omitted, null, or undefined argument
  if (input == null) {
    return SKIPPED_RESULT;
  }

  // Validate financial input payload
  const inputValidation = ApplicationFeeInputSchema.safeParse(input);
  if (!inputValidation.success) {
    return {
      success: false,
      error: 'Invalid application fee value',
    };
  }

  // Validate optional configuration options if provided
  if (options != null) {
    const optionsValidation = ApplicationFeeOptionsSchema.safeParse(options);
    if (!optionsValidation.success) {
      return {
        success: false,
        error: 'Invalid application fee value',
      };
    }
  }

  const effectiveLimit = options?.maxFee ?? DEFAULT_MAX_APPLICATION_FEE;
  const { applicationFee } = inputValidation.data;

  // Guard against unpopulated financial parameters
  if (applicationFee == null) {
    return SKIPPED_RESULT;
  }

  // Compliant with statutory limits
  if (applicationFee <= effectiveLimit) {
    return {
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Complies with California statutory screening fee limits',
        statutoryCitation: CITATION_STANDARD,
      },
    };
  }

  // Violation exceeding statutory limit
  return {
    success: true,
    data: {
      status: 'violation',
      flag: 'EXCESSIVE_APPLICATION_FEE',
      message: `Application screening fee exceeds California statutory limit of $${effectiveLimit}`,
      statutoryCitation: CITATION_VIOLATION,
    },
  };
}
