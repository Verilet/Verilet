import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GisQueryInputSchema,
  normalizeAddress,
  evaluateGisQuery,
} from '../src/services/gisQuery.service.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SCRUM-20-T-1 GIS Query Service', () => {
  // Criterion 1:
  // A valid Santa Cruz parcel returns compliant and includes parcel details.
  it('SCRUM-20-T-1 returns compliant when a parcel is found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            attributes: {
              APN: '123456',
              SITEADD: '530 HIGH ST',
              CITY: 'SANTA CRUZ',
              ZIP: '95064',
              USECODE: '101',
              USECDDESC: 'Single Residence',
            },
          },
        ],
      }),
    } as Response);
    const result = await evaluateGisQuery({
      address: '530 High St',
    });
    expect(result).toEqual({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Address verified in county parcel records',
        parcel: {
          apn: '123456',
          siteAddress: '530 HIGH ST',
          city: 'SANTA CRUZ',
          zip: '95064',
          useCode: '101',
          useDescription: 'Single Residence',
        },
      },
    });
  });

  // Criterion 2:
  // An address containing an apartment or unit number
  // normalizes cleanly and resolves to the base parcel.
  it('SCRUM-20-T-1 removes apartment numbers', () => {
    expect(normalizeAddress('530 High St Apt 4B')).toBe('530 HIGH ST');
  });

  // Criterion 2:
  // Apartment designators containing periods normalize
  // to the base parcel address.
  it('SCRUM-20-T-1 removes apartment numbers with periods', () => {
    expect(normalizeAddress('530 High St Apt. 4B')).toBe('530 HIGH ST');
  });

  // Criterion 2:
  // Suite designators containing periods normalize
  // to the base parcel address.
  it('SCRUM-20-T-1 removes suite numbers with periods', () => {
    expect(normalizeAddress('530 High St Ste. 100')).toBe('530 HIGH ST');
  });

  // Criterion 2:
  // Suite designators without periods normalize
  // to the base parcel address.
  it('SCRUM-20-T-1 removes suite numbers', () => {
    expect(normalizeAddress('530 High St Ste 100')).toBe('530 HIGH ST');
  });

  // Criterion 2:
  // Hash-style unit identifiers with spaces normalize
  // to the base parcel address.
  it('SCRUM-20-T-1 removes spaced hash unit identifiers', () => {
    expect(normalizeAddress('530 High St # 12')).toBe('530 HIGH ST');
  });

  // Criterion 2:
  // Hash-style unit identifiers are removed before parcel lookup.
  it('SCRUM-20-T-1 removes hash unit identifiers', () => {
    expect(normalizeAddress('530 High St #12')).toBe('530 HIGH ST');
  });

  // Criterion 2:
  // Address capitalization and spacing are normalized
  // before querying GIS records.
  it('SCRUM-20-T-1 normalizes whitespace and capitalization', () => {
    expect(normalizeAddress('  530   High   St  ')).toBe('530 HIGH ST');
  });

  // Criterion 2:
  // Apartment designators preceded by commas are removed
  // to normalize to the base parcel address.
  it('SCRUM-20-T-1 removes apartment numbers with commas', () => {
    expect(normalizeAddress('530 High St, Apt 4B')).toBe('530 HIGH ST');
  });

  // Criterion 2:
  // Hash-style unit identifiers preceded by commas are removed
  // to normalize to the base parcel address.
  it('SCRUM-20-T-1 removes hash unit identifiers with commas', () => {
    expect(normalizeAddress('530 High St, #12')).toBe('530 HIGH ST');
  });

  // Criterion 2:
  // Commas separating street, city, and state are preserved
  // during address normalization.
  it('SCRUM-20-T-1 preserves commas between address components', () => {
    expect(normalizeAddress('530 High St, Santa Cruz, CA')).toBe('530 HIGH ST, SANTA CRUZ, CA');
  });

  // Requirement 2:
  // Zod schema accepts valid address payloads.
  it('SCRUM-20-T-1 schema accepts string addresses', () => {
    expect(
      GisQueryInputSchema.safeParse({
        address: '530 High St',
      }).success,
    ).toBe(true);
  });

  // Requirement 2:
  // Zod schema accepts null addresses.
  it('SCRUM-20-T-1 schema accepts null addresses', () => {
    expect(
      GisQueryInputSchema.safeParse({
        address: null,
      }).success,
    ).toBe(true);
  });

  // Criterion 3:
  // Non-existent addresses return warning and UNVERIFIED_ADDRESS.
  it('SCRUM-20-T-1 returns warning when no parcel is found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [],
      }),
    } as Response);
    const result = await evaluateGisQuery({
      address: '999 Fake Street',
    });
    expect(result).toEqual({
      success: true,
      data: {
        status: 'warning',
        flag: 'UNVERIFIED_ADDRESS',
        message: 'Address could not be verified in Santa Cruz County records',
        parcel: null,
      },
    });
  });

  // Criterion 4:
  // Missing address inputs return skipped status.
  it('SCRUM-20-T-1 returns skipped when input is undefined', async () => {
    const result = await evaluateGisQuery();
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Address not specified; check skipped',
        parcel: null,
      },
    });
  });

  // Criterion 4:
  // Null addresses return skipped status.
  it('SCRUM-20-T-1 returns skipped when address is null', async () => {
    const result = await evaluateGisQuery({
      address: null,
    });
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Address not specified; check skipped',
        parcel: null,
      },
    });
  });

  // Criterion 4:
  // Empty addresses return skipped status.
  it('SCRUM-20-T-1 returns skipped when address is empty', async () => {
    const result = await evaluateGisQuery({
      address: '',
    });
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Address not specified; check skipped',
        parcel: null,
      },
    });
  });

  // Criterion 4:
  // Whitespace-only addresses return skipped status.
  it('SCRUM-20-T-1 returns skipped when address is whitespace only', async () => {
    const result = await evaluateGisQuery({
      address: '     ',
    });
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Address not specified; check skipped',
        parcel: null,
      },
    });
  });

  // Criterion 5:
  // HTTP 4xx/5xx responses return GIS_SERVICE_UNAVAILABLE.
  it('SCRUM-20-T-1 returns skipped when GIS service returns an HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
    } as Response);
    const result = await evaluateGisQuery({
      address: '530 High St',
    });
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: 'GIS_SERVICE_UNAVAILABLE',
        message: 'County GIS service timed out or unavailable; check skipped',
        parcel: null,
      },
    });
  });

  // Criterion 5:
  // Network failures and timeout scenarios return GIS_SERVICE_UNAVAILABLE.
  it('SCRUM-20-T-1 returns skipped when GIS service throws an error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    const result = await evaluateGisQuery({
      address: '530 High St',
    });
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: 'GIS_SERVICE_UNAVAILABLE',
        message: 'County GIS service timed out or unavailable; check skipped',
        parcel: null,
      },
    });
  });

  // Criterion 5:
  // ArcGIS error payloads are treated as GIS service outages
  // and return GIS_SERVICE_UNAVAILABLE.
  it('SCRUM-20-T-1 returns skipped when GIS returns an error payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        error: {
          code: 500,
        },
      }),
    } as Response);
    const result = await evaluateGisQuery({
      address: '530 High St',
    });
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: 'GIS_SERVICE_UNAVAILABLE',
        message: 'County GIS service timed out or unavailable; check skipped',
        parcel: null,
      },
    });
  });

  // Criterion 6:
  // Non-string address values are rejected cleanly.
  it('SCRUM-20-T-1 schema rejects non-string address values', () => {
    expect(
      GisQueryInputSchema.safeParse({
        address: 123,
      }).success,
    ).toBe(false);
  });

  // Criterion 6:
  // Invalid address input types are rejected with success:false.
  it('SCRUM-20-T-1 rejects invalid address input values', async () => {
    const result = await evaluateGisQuery({
      address: 123,
    } as unknown as Record<string, unknown>);
    expect(result).toEqual({
      success: false,
      error: 'Invalid address input value',
    });
  });
});
