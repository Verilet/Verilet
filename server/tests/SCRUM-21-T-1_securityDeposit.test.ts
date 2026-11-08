import { describe, it, expect } from 'vitest';
import {
  evaluateSecurityDeposit,
  SecurityDepositInputSchema,
} from '../src/services/securityDeposit.service.js';

describe('SCRUM-21-T-1 Security Deposit Statutory Evaluation Service', () => {
  // Criterion 1: A security deposit less than or equal to 1 month's rent returns status: "compliant"
  // with zero red flags and confirms AB 12 compliance.
  it('SCRUM-21-T-1 returns compliant when deposit is <= 1x rent', () => {
    // Deposit exactly equal to 1 month's rent
    const exactRentResult = evaluateSecurityDeposit({ rent: 2500, deposit: 2500 });
    expect(exactRentResult).toEqual({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Complies with California standard statutory limit (AB 12)',
        statutoryCitation: 'Cal. Civ. Code § 1950.5(c)',
      },
    });

    // Deposit less than 1 month's rent
    const lowerDepositResult = evaluateSecurityDeposit({ rent: 3000, deposit: 1500 });
    expect(lowerDepositResult).toEqual({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Complies with California standard statutory limit (AB 12)',
        statutoryCitation: 'Cal. Civ. Code § 1950.5(c)',
      },
    });

    // Zero deposit (fully compliant)
    const zeroDepositResult = evaluateSecurityDeposit({ rent: 2000, deposit: 0 });
    expect(zeroDepositResult).toEqual({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Complies with California standard statutory limit (AB 12)',
        statutoryCitation: 'Cal. Civ. Code § 1950.5(c)',
      },
    });
  });

  // Criterion 2: A security deposit greater than 1x rent and less than or equal to 2x rent returns status: "warning"
  // and triggers flag EXCEEDS_STANDARD_DEPOSIT_CAP.
  it('SCRUM-21-T-1 returns warning and EXCEEDS_STANDARD_DEPOSIT_CAP when 1x < deposit <= 2x rent', () => {
    // Deposit slightly exceeding 1x rent (e.g. 1.2x)
    const slightlyOverResult = evaluateSecurityDeposit({ rent: 2000, deposit: 2400 });
    expect(slightlyOverResult).toEqual({
      success: true,
      data: {
        status: 'warning',
        flag: 'EXCEEDS_STANDARD_DEPOSIT_CAP',
        message:
          'Deposit exceeds standard 1-month cap; only lawful if landlord qualifies for AB 12 small landlord exemption',
        statutoryCitation: 'Cal. Civ. Code § 1950.5(c)(4)',
      },
    });

    // Deposit at 1.5x rent
    const onePointFiveResult = evaluateSecurityDeposit({ rent: 2000, deposit: 3000 });
    expect(onePointFiveResult).toEqual({
      success: true,
      data: {
        status: 'warning',
        flag: 'EXCEEDS_STANDARD_DEPOSIT_CAP',
        message:
          'Deposit exceeds standard 1-month cap; only lawful if landlord qualifies for AB 12 small landlord exemption',
        statutoryCitation: 'Cal. Civ. Code § 1950.5(c)(4)',
      },
    });

    // Deposit exactly at the 2x small landlord ceiling
    const exactlyTwoXResult = evaluateSecurityDeposit({ rent: 2000, deposit: 4000 });
    expect(exactlyTwoXResult).toEqual({
      success: true,
      data: {
        status: 'warning',
        flag: 'EXCEEDS_STANDARD_DEPOSIT_CAP',
        message:
          'Deposit exceeds standard 1-month cap; only lawful if landlord qualifies for AB 12 small landlord exemption',
        statutoryCitation: 'Cal. Civ. Code § 1950.5(c)(4)',
      },
    });
  });

  // Criterion 3: A security deposit exceeding 2x rent returns status: "violation"
  // and triggers flag ILLEGAL_SECURITY_DEPOSIT.
  it('SCRUM-21-T-1 returns violation and ILLEGAL_SECURITY_DEPOSIT when deposit > 2x rent', () => {
    // Deposit slightly over 2x rent
    const slightlyOverTwoX = evaluateSecurityDeposit({ rent: 2000, deposit: 4001 });
    expect(slightlyOverTwoX).toEqual({
      success: true,
      data: {
        status: 'violation',
        flag: 'ILLEGAL_SECURITY_DEPOSIT',
        message: "Deposit exceeds absolute California statutory ceiling of 2 months' rent",
        statutoryCitation: 'Cal. Civ. Code § 1950.5(c)',
      },
    });

    // Excessive deposit (e.g. 3x rent)
    const threeXResult = evaluateSecurityDeposit({ rent: 2000, deposit: 6000 });
    expect(threeXResult).toEqual({
      success: true,
      data: {
        status: 'violation',
        flag: 'ILLEGAL_SECURITY_DEPOSIT',
        message: "Deposit exceeds absolute California statutory ceiling of 2 months' rent",
        statutoryCitation: 'Cal. Civ. Code § 1950.5(c)',
      },
    });
  });

  // Criterion 4: Missing, null, or undefined deposit or rent inputs return status: "skipped"
  // without throwing errors or generating false positive flags.
  it('SCRUM-21-T-1 returns skipped when rent or deposit is missing, null, or undefined', () => {
    // Null deposit
    const nullDeposit = evaluateSecurityDeposit({ rent: 2000, deposit: null });
    expect(nullDeposit).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Deposit or rent not specified; check skipped',
        statutoryCitation: null,
      },
    });

    // Null rent
    const nullRent = evaluateSecurityDeposit({ rent: null, deposit: 2000 });
    expect(nullRent).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Deposit or rent not specified; check skipped',
        statutoryCitation: null,
      },
    });

    // Undefined deposit
    const undefinedDeposit = evaluateSecurityDeposit({ rent: 2000, deposit: undefined });
    expect(undefinedDeposit).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Deposit or rent not specified; check skipped',
        statutoryCitation: null,
      },
    });

    // Undefined rent
    const undefinedRent = evaluateSecurityDeposit({ rent: undefined, deposit: 2000 });
    expect(undefinedRent).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Deposit or rent not specified; check skipped',
        statutoryCitation: null,
      },
    });

    // Both missing (empty object)
    const emptyObj = evaluateSecurityDeposit({});
    expect(emptyObj).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Deposit or rent not specified; check skipped',
        statutoryCitation: null,
      },
    });

    // Both null
    const bothNull = evaluateSecurityDeposit({ rent: null, deposit: null });
    expect(bothNull).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Deposit or rent not specified; check skipped',
        statutoryCitation: null,
      },
    });

    // Zero rent (unrealistic rent; check skipped)
    const zeroRent = evaluateSecurityDeposit({ rent: 0, deposit: 2000 });
    expect(zeroRent).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Deposit or rent not specified; check skipped',
        statutoryCitation: null,
      },
    });

    // Null or undefined passed directly
    expect(evaluateSecurityDeposit(null)).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Deposit or rent not specified; check skipped',
        statutoryCitation: null,
      },
    });

    expect(evaluateSecurityDeposit(undefined)).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Deposit or rent not specified; check skipped',
        statutoryCitation: null,
      },
    });
  });

  // Criterion 5: Negative numeric values or non-numeric types are rejected with { success: false }
  // and a descriptive error message without crashing the server process.
  it('SCRUM-21-T-1 rejects negative values and invalid non-numeric data types cleanly', () => {
    // Negative rent
    const negRent = evaluateSecurityDeposit({ rent: -1000, deposit: 2000 });
    expect(negRent).toEqual({
      success: false,
      error: 'Invalid financial input values',
    });

    // Negative deposit
    const negDeposit = evaluateSecurityDeposit({ rent: 2000, deposit: -500 });
    expect(negDeposit).toEqual({
      success: false,
      error: 'Invalid financial input values',
    });

    // Both negative
    const bothNeg = evaluateSecurityDeposit({ rent: -2000, deposit: -2000 });
    expect(bothNeg).toEqual({
      success: false,
      error: 'Invalid financial input values',
    });

    // Non-numeric string inputs
    const stringRent = evaluateSecurityDeposit({
      rent: '2000' as unknown as number,
      deposit: 2000,
    });
    expect(stringRent).toEqual({
      success: false,
      error: 'Invalid financial input values',
    });

    const stringDeposit = evaluateSecurityDeposit({
      rent: 2000,
      deposit: '2000' as unknown as number,
    });
    expect(stringDeposit).toEqual({
      success: false,
      error: 'Invalid financial input values',
    });

    // Boolean inputs
    const boolInput = evaluateSecurityDeposit({ rent: true as unknown as number, deposit: 2000 });
    expect(boolInput).toEqual({
      success: false,
      error: 'Invalid financial input values',
    });

    // NaN / Infinity inputs
    const nanInput = evaluateSecurityDeposit({ rent: NaN, deposit: 2000 });
    expect(nanInput).toEqual({
      success: false,
      error: 'Invalid financial input values',
    });

    const infInput = evaluateSecurityDeposit({ rent: 2000, deposit: Infinity });
    expect(infInput).toEqual({
      success: false,
      error: 'Invalid financial input values',
    });

    // Primitive / malformed input (neither object nor null/undefined)
    const malformed = evaluateSecurityDeposit(
      'invalid string input' as unknown as Record<string, unknown>,
    );
    expect(malformed).toEqual({
      success: false,
      error: 'Invalid financial input values',
    });

    const numericPrimitive = evaluateSecurityDeposit(12345 as unknown as Record<string, unknown>);
    expect(numericPrimitive).toEqual({
      success: false,
      error: 'Invalid financial input values',
    });
  });

  // Validate Zod schema export
  it('exposes SecurityDepositInputSchema that parses valid and invalid payloads', () => {
    expect(SecurityDepositInputSchema.safeParse({ rent: 2000, deposit: 2000 }).success).toBe(true);
    expect(SecurityDepositInputSchema.safeParse({ rent: null, deposit: null }).success).toBe(true);
    expect(SecurityDepositInputSchema.safeParse({}).success).toBe(true);
    expect(SecurityDepositInputSchema.safeParse({ rent: -100 }).success).toBe(false);
    expect(SecurityDepositInputSchema.safeParse({ deposit: 'bad' }).success).toBe(false);
  });
});
