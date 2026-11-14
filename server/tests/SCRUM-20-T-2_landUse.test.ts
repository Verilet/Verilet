import { describe, expect, it } from 'vitest';
import { LandUseInputSchema, evaluateLandUse } from '../src/services/landUse.service.js';

describe('SCRUM-20-T-2 Land Use Service', () => {
  // Criterion 1:
  // Residential land-use codes return compliant status
  // without a violation flag.
  it('SCRUM-20-T-2 returns compliant for residential land use', () => {
    const residentialCodes = ['020', '021', '030', '041'];
    for (const useCode of residentialCodes) {
      const result = evaluateLandUse({
        useCode,
        useDescription: 'Residential Property',
      });
      expect(result).toEqual({
        success: true,
        data: {
          status: 'compliant',
          flag: null,
          message: 'Complies with lawful residential land use',
          category: 'residential',
        },
      });
    }
  });

  // Criterion 2:
  // Commercial, office, and municipal land-use codes
  // return violation status with NON_RESIDENTIAL_LAND_USE.
  it('SCRUM-20-T-2 returns violation for commercial land use', () => {
    const commercialCodes = ['121', '171', '921'];
    for (const useCode of commercialCodes) {
      const result = evaluateLandUse({
        useCode,
        useDescription: 'Commercial Property',
      });
      expect(result).toEqual({
        success: true,
        data: {
          status: 'violation',
          flag: 'NON_RESIDENTIAL_LAND_USE',
          message: 'Property is designated for commercial or municipal use, not residential living',
          category: 'commercial',
        },
      });
    }
  });

  // Criterion 3:
  // Vacant and unbuilt land-use codes return warning status
  // with VACANT_OR_UNBUILT_PARCEL.
  it('SCRUM-20-T-2 returns warning for vacant land use', () => {
    const vacantCodes = ['010', '830', '090'];
    for (const useCode of vacantCodes) {
      const result = evaluateLandUse({
        useCode,
        useDescription: 'Vacant Property',
      });
      expect(result).toEqual({
        success: true,
        data: {
          status: 'warning',
          flag: 'VACANT_OR_UNBUILT_PARCEL',
          message: 'Property is classified as vacant land or unbuilt parcel',
          category: 'vacant',
        },
      });
    }
  });

  // Requirement 1:
  // Zod schema accepts valid string land-use values.
  it('SCRUM-20-T-2 schema accepts string land-use values', () => {
    expect(
      LandUseInputSchema.safeParse({
        useCode: '020',
        useDescription: 'Single Residence',
      }).success,
    ).toBe(true);
  });

  // Requirement 1:
  // Zod schema accepts null land-use values.
  it('SCRUM-20-T-2 schema accepts null land-use values', () => {
    expect(
      LandUseInputSchema.safeParse({
        useCode: null,
        useDescription: null,
      }).success,
    ).toBe(true);
  });

  // Criterion 4:
  // Missing land-use information returns skipped status.
  it('SCRUM-20-T-2 returns skipped when input is undefined', () => {
    const result = evaluateLandUse();
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Land use code not specified; check skipped',
        category: null,
      },
    });
  });

  // Criterion 4:
  // Null land-use information returns skipped status.
  it('SCRUM-20-T-2 returns skipped when input is null', () => {
    const result = evaluateLandUse(null);
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Land use code not specified; check skipped',
        category: null,
      },
    });
  });

  // Criterion 4:
  // Missing use codes return skipped status.
  it('SCRUM-20-T-2 returns skipped when use code is missing', () => {
    const result = evaluateLandUse({
      useDescription: 'Single Residence',
    });
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Land use code not specified; check skipped',
        category: null,
      },
    });
  });

  // Criterion 4:
  // Missing use descriptions return skipped status.
  it('SCRUM-20-T-2 returns skipped when use description is missing', () => {
    const result = evaluateLandUse({
      useCode: '020',
    });
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Land use code not specified; check skipped',
        category: null,
      },
    });
  });

  // Criterion 4:
  // Empty land-use values return skipped status.
  it('SCRUM-20-T-2 returns skipped when land-use values are empty', () => {
    const result = evaluateLandUse({
      useCode: '',
      useDescription: '',
    });
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Land use code not specified; check skipped',
        category: null,
      },
    });
  });

  // Criterion 4:
  // A null use code returns skipped status.
  it('SCRUM-20-T-2 returns skipped when use code is null', () => {
    const result = evaluateLandUse({
      useCode: null,
      useDescription: 'Single Residence',
    });
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Land use code not specified; check skipped',
        category: null,
      },
    });
  });

  // Criterion 4:
  // A null use description returns skipped status.
  it('SCRUM-20-T-2 returns skipped when use description is null', () => {
    const result = evaluateLandUse({
      useCode: '020',
      useDescription: null,
    });
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Land use code not specified; check skipped',
        category: null,
      },
    });
  });

  // Criterion 4:
  // Whitespace-only land-use values return skipped status.
  it('SCRUM-20-T-2 returns skipped when land-use values contain only whitespace', () => {
    const result = evaluateLandUse({
      useCode: '   ',
      useDescription: '   ',
    });
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Land use code not specified; check skipped',
        category: null,
      },
    });
  });

  // Requirement 2:
  // Non-string land-use values are rejected by the schema.
  it('SCRUM-20-T-2 schema rejects non-string land-use values', () => {
    expect(
      LandUseInputSchema.safeParse({
        useCode: 20,
        useDescription: 'Single Residence',
      }).success,
    ).toBe(false);
  });

  // Criterion 5:
  // Invalid land-use input values return success:false
  // without throwing an exception.
  it('SCRUM-20-T-2 rejects invalid land-use input values', () => {
    const result = evaluateLandUse({
      useCode: 20,
      useDescription: 'Single Residence',
    });
    expect(result).toEqual({
      success: false,
      error: 'Invalid land use input values',
    });
  });

  // Criterion 6:
  // Recognized land-use descriptions can classify an
  // otherwise unrecognized land-use code.
  it('SCRUM-20-T-2 classifies land use using its description when code is unknown', () => {
    const result = evaluateLandUse({
      useCode: '999',
      useDescription: 'Single Residence',
    });
    expect(result).toEqual({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Complies with lawful residential land use',
        category: 'residential',
      },
    });
  });

  // Criterion 6:
  // Unknown codes and descriptions return skipped status.
  it('SCRUM-20-T-2 returns skipped for unknown land-use information', () => {
    const result = evaluateLandUse({
      useCode: '999',
      useDescription: 'Unknown Property Type',
    });
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Land use code not specified; check skipped',
        category: null,
      },
    });
  });
});
