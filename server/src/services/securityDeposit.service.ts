import { z } from 'zod';

/** Legal citations under California Civil Code § 1950.5 (AB 12). */
const CITATION_STANDARD = 'Cal. Civ. Code § 1950.5(c)';
const CITATION_SMALL_LANDLORD = 'Cal. Civ. Code § 1950.5(c)(4)';

/** Zod schema for inputs for California security deposit evaluation. */
export const SecurityDepositInputSchema = z.object({
  /** Monthly rent price, or null/undefined if unspecified. */
  rent: z.number().min(0).finite().nullish(),
  /** Requested security deposit amount, or null/undefined if unspecified. */
  deposit: z.number().min(0).finite().nullish(),
});

/** Input payload for security deposit evaluation. */
export type SecurityDepositInput = z.infer<typeof SecurityDepositInputSchema>;

/** Statutory compliance status under California tenancy law. */
export type SecurityDepositStatus = 'compliant' | 'warning' | 'violation' | 'skipped';

/** Risk and violation flags for security deposit evaluation. */
export type SecurityDepositFlag = 'EXCEEDS_STANDARD_DEPOSIT_CAP' | 'ILLEGAL_SECURITY_DEPOSIT';

/** Financial evaluation result payload. */
export interface SecurityDepositData {
  /** Compliance status classification. */
  readonly status: SecurityDepositStatus;
  /** Violation or warning flag, or null if compliant/skipped. */
  readonly flag: SecurityDepositFlag | null;
  /** Human-readable explanatory message explaining statutory finding. */
  readonly message: string;
  /** Formal statutory legal citation or null if skipped. */
  readonly statutoryCitation: string | null;
}

/** JSON envelope returned by the security deposit evaluation service. */
export type SecurityDepositResult =
  | {
      /** Whether the evaluation completed without fatal input errors. */
      readonly success: true;
      /** Statutory findings and flags. */
      readonly data: SecurityDepositData;
    }
  | {
      /** Indicates evaluation could not be performed due to invalid input. */
      readonly success: false;
      /** Error message describing validation failure. */
      readonly error: string;
      /** Optional detail message describing specific validation issue. */
      readonly details?: string;
    };

/** Evaluation envelope returned when rent or deposit is unpopulated or zero. */
const SKIPPED_RESULT: SecurityDepositResult = Object.freeze({
  success: true,
  data: Object.freeze({
    status: 'skipped',
    flag: null,
    message: 'Deposit or rent not specified; check skipped',
    statutoryCitation: null,
  }),
});

/**
 * Evaluates requested security deposit against monthly rent under California AB 12.
 *
 * @param input Financial input containing rent and deposit.
 * @return Evaluation envelope conforming to project architecture.
 */
export function evaluateSecurityDeposit(
  input?: SecurityDepositInput | null,
): SecurityDepositResult {
  // Guard against omitted, null, or undefined argument
  if (input == null) {
    return SKIPPED_RESULT;
  }

  // Rejects negative numbers, non-numeric types, NaN, Infinity
  const validation = SecurityDepositInputSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: 'Invalid financial input values',
    };
  }

  const { rent, deposit } = validation.data;

  // Guard against unpopulated financial parameters or unrealistic zero rent
  if (rent == null || deposit == null || rent === 0) {
    return SKIPPED_RESULT;
  }

  // Compliant with 1-month cap
  if (deposit <= rent) {
    return {
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Complies with California standard statutory limit (AB 12)',
        statutoryCitation: CITATION_STANDARD,
      },
    };
  }

  // Warning for small landlord exemption
  if (deposit <= 2 * rent) {
    return {
      success: true,
      data: {
        status: 'warning',
        flag: 'EXCEEDS_STANDARD_DEPOSIT_CAP',
        message:
          'Deposit exceeds standard 1-month cap; only lawful if landlord qualifies for AB 12 small landlord exemption',
        statutoryCitation: CITATION_SMALL_LANDLORD,
      },
    };
  }

  // Illegal deposit exceeding 2-month statutory ceiling
  return {
    success: true,
    data: {
      status: 'violation',
      flag: 'ILLEGAL_SECURITY_DEPOSIT',
      message: "Deposit exceeds absolute California statutory ceiling of 2 months' rent",
      statutoryCitation: CITATION_STANDARD,
    },
  };
}
