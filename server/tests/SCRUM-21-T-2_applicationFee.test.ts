import { describe, it, expect } from 'vitest';
import {
  evaluateApplicationFee,
  DEFAULT_MAX_APPLICATION_FEE,
  ApplicationFeeInputSchema,
  ApplicationFeeOptionsSchema,
} from '../src/services/applicationFee.service.js';

describe('SCRUM-21-T-2 Application Fee Statutory Evaluation Service', () => {
  // Criterion 1: An application fee less than or equal to $65 (including $0) returns status: "compliant"
  // with zero red flags and confirms statutory compliance.
  it('SCRUM-21-T-2 returns compliant when application fee is <= $65', () => {
    // Standard valid screening fee below $65
    const typicalFeeResult = evaluateApplicationFee({ applicationFee: 35 });
    expect(typicalFeeResult).toEqual({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Complies with California statutory screening fee limits',
        statutoryCitation: 'Cal. Civ. Code § 1950.6',
      },
    });

    // Zero dollar screening fee (free application)
    const zeroFeeResult = evaluateApplicationFee({ applicationFee: 0 });
    expect(zeroFeeResult).toEqual({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Complies with California statutory screening fee limits',
        statutoryCitation: 'Cal. Civ. Code § 1950.6',
      },
    });

    // Nominal fee ($10)
    const nominalFeeResult = evaluateApplicationFee({ applicationFee: 10 });
    expect(nominalFeeResult).toEqual({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Complies with California statutory screening fee limits',
        statutoryCitation: 'Cal. Civ. Code § 1950.6',
      },
    });
  });

  // Criterion 2: An application fee strictly exceeding $65 returns status: "violation"
  // and triggers flag EXCESSIVE_APPLICATION_FEE.
  it('SCRUM-21-T-2 returns violation and EXCESSIVE_APPLICATION_FEE when application fee > $65', () => {
    // Fee slightly exceeding standard statutory limit ($66)
    const slightlyOverResult = evaluateApplicationFee({ applicationFee: 66 });
    expect(slightlyOverResult).toEqual({
      success: true,
      data: {
        status: 'violation',
        flag: 'EXCESSIVE_APPLICATION_FEE',
        message: 'Application screening fee exceeds California statutory limit of $65',
        statutoryCitation: 'Cal. Civ. Code § 1950.6(b)',
      },
    });

    // Substantially excessive application fee ($100)
    const excessiveFeeResult = evaluateApplicationFee({ applicationFee: 100 });
    expect(excessiveFeeResult).toEqual({
      success: true,
      data: {
        status: 'violation',
        flag: 'EXCESSIVE_APPLICATION_FEE',
        message: 'Application screening fee exceeds California statutory limit of $65',
        statutoryCitation: 'Cal. Civ. Code § 1950.6(b)',
      },
    });
  });

  // Criterion 3: Missing, null, or undefined applicationFee inputs return status: "skipped"
  // without throwing errors or generating false positive flags.
  it('SCRUM-21-T-2 returns skipped when application fee is missing, null, or undefined', () => {
    // Explicit null application fee
    const nullFeeResult = evaluateApplicationFee({ applicationFee: null });
    expect(nullFeeResult).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Application fee not specified; check skipped',
        statutoryCitation: null,
      },
    });

    // Explicit undefined application fee
    const undefinedFeeResult = evaluateApplicationFee({ applicationFee: undefined });
    expect(undefinedFeeResult).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Application fee not specified; check skipped',
        statutoryCitation: null,
      },
    });

    // Empty object payload (field omitted)
    const emptyObjectResult = evaluateApplicationFee({});
    expect(emptyObjectResult).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Application fee not specified; check skipped',
        statutoryCitation: null,
      },
    });

    // Null input argument
    const nullArgResult = evaluateApplicationFee(null);
    expect(nullArgResult).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Application fee not specified; check skipped',
        statutoryCitation: null,
      },
    });

    // Undefined (omitted) input argument
    const omittedArgResult = evaluateApplicationFee();
    expect(omittedArgResult).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Application fee not specified; check skipped',
        statutoryCitation: null,
      },
    });
  });

  // Criterion 4: An application fee of exact boundary value $65 passes as compliant.
  it('SCRUM-21-T-2 returns compliant for exact boundary value of $65', () => {
    const boundaryResult = evaluateApplicationFee({ applicationFee: 65 });
    expect(boundaryResult).toEqual({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Complies with California statutory screening fee limits',
        statutoryCitation: 'Cal. Civ. Code § 1950.6',
      },
    });
  });

  // Criterion 5: A custom future statutory cap passed via options (e.g. $70) is respected,
  // so a fee above $65 but within the custom cap returns status: "compliant", while a fee above the custom cap returns status: "violation".
  it('SCRUM-21-T-2 respects custom future statutory cap passed via options', () => {
    // Fee of $68 would violate standard $65 cap, but complies under future $70 cap
    const futureCompliantResult = evaluateApplicationFee({ applicationFee: 68 }, { maxFee: 70 });
    expect(futureCompliantResult).toEqual({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Complies with California statutory screening fee limits',
        statutoryCitation: 'Cal. Civ. Code § 1950.6',
      },
    });

    // Exact boundary on custom limit ($70)
    const futureBoundaryResult = evaluateApplicationFee({ applicationFee: 70 }, { maxFee: 70 });
    expect(futureBoundaryResult).toEqual({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Complies with California statutory screening fee limits',
        statutoryCitation: 'Cal. Civ. Code § 1950.6',
      },
    });

    // Fee exceeding future $70 cap ($75)
    const futureViolationResult = evaluateApplicationFee({ applicationFee: 75 }, { maxFee: 70 });
    expect(futureViolationResult).toEqual({
      success: true,
      data: {
        status: 'violation',
        flag: 'EXCESSIVE_APPLICATION_FEE',
        message: 'Application screening fee exceeds California statutory limit of $70',
        statutoryCitation: 'Cal. Civ. Code § 1950.6(b)',
      },
    });
  });

  // Criterion 6: Negative numeric values or non-numeric types are rejected with { success: false }
  // and a descriptive error message without crashing the server process.
  it('SCRUM-21-T-2 rejects negative values and invalid non-numeric data types cleanly', () => {
    // Negative fee
    const negativeFeeResult = evaluateApplicationFee({ applicationFee: -20 });
    expect(negativeFeeResult).toEqual({
      success: false,
      error: 'Invalid application fee value',
    });

    // Non-numeric string fee
    const stringFeeResult = evaluateApplicationFee({
      applicationFee: '50' as unknown as number,
    });
    expect(stringFeeResult).toEqual({
      success: false,
      error: 'Invalid application fee value',
    });

    // Boolean fee
    const booleanFeeResult = evaluateApplicationFee({
      applicationFee: true as unknown as number,
    });
    expect(booleanFeeResult).toEqual({
      success: false,
      error: 'Invalid application fee value',
    });

    // NaN / Infinity inputs
    const nanFeeResult = evaluateApplicationFee({ applicationFee: NaN });
    expect(nanFeeResult).toEqual({
      success: false,
      error: 'Invalid application fee value',
    });

    const infFeeResult = evaluateApplicationFee({ applicationFee: Infinity });
    expect(infFeeResult).toEqual({
      success: false,
      error: 'Invalid application fee value',
    });

    // Primitive malformed input
    const malformedResult = evaluateApplicationFee(
      'invalid string' as unknown as Record<string, unknown>,
    );
    expect(malformedResult).toEqual({
      success: false,
      error: 'Invalid application fee value',
    });

    // Invalid negative options maxFee
    const invalidOptionsResult = evaluateApplicationFee({ applicationFee: 50 }, { maxFee: -10 });
    expect(invalidOptionsResult).toEqual({
      success: false,
      error: 'Invalid application fee value',
    });
  });

  // Baseline constant and schema export tests
  it('exports DEFAULT_MAX_APPLICATION_FEE equal to 65', () => {
    expect(DEFAULT_MAX_APPLICATION_FEE).toBe(65);
  });

  it('exposes schemas that validate expected payloads', () => {
    expect(ApplicationFeeInputSchema.safeParse({ applicationFee: 50 }).success).toBe(true);
    expect(ApplicationFeeInputSchema.safeParse({ applicationFee: null }).success).toBe(true);
    expect(ApplicationFeeInputSchema.safeParse({ applicationFee: -1 }).success).toBe(false);
    expect(ApplicationFeeOptionsSchema.safeParse({ maxFee: 70 }).success).toBe(true);
    expect(ApplicationFeeOptionsSchema.safeParse({ maxFee: -5 }).success).toBe(false);
  });
});
