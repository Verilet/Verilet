import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AreaCodeModel } from '../src/models/areaCode.model.js';

const { findOneMock } = vi.hoisted(() => ({
  findOneMock: vi.fn(),
}));

vi.mock('../src/models/areaCode.model.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/models/areaCode.model.js')>();

  return {
    ...actual,
    AreaCodeModel: Object.assign(actual.AreaCodeModel, {
      findOne: findOneMock,
    }),
  };
});

import { PhoneFlagInputSchema, evaluatePhoneAreaCode } from '../src/services/phoneFlags.service.js';

beforeEach(() => {
  findOneMock.mockReset();
  findOneMock.mockResolvedValue({
    state: 'CA',
    codes: ['408', '415', '510', '619', '650', '707', '831'],
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// Criterion 1:
// The AreaCodeModel validates required fields, state format, area-code format,
// uppercase state normalization, and the unique state index.
describe('AreaCodeModel', () => {
  it('SCRUM-16-T-1 accepts a valid state area-code mapping', () => {
    const areaCode = new AreaCodeModel({
      state: 'CA',
      codes: ['408', '415', '650', '831'],
    });
    expect(areaCode.validateSync()).toBeUndefined();
  });

  it('SCRUM-16-T-1 requires a state', () => {
    const areaCode = new AreaCodeModel({
      codes: ['408', '831'],
    });
    expect(areaCode.validateSync()).toBeDefined();
  });

  it('SCRUM-16-T-1 requires an area-code array', () => {
    const areaCode = new AreaCodeModel({
      state: 'CA',
    });
    expect(areaCode.validateSync()).toBeDefined();
  });

  it('SCRUM-16-T-1 rejects an invalid state code', () => {
    const areaCode = new AreaCodeModel({
      state: 'California',
      codes: ['408'],
    });
    expect(areaCode.validateSync()).toBeDefined();
  });

  it('SCRUM-16-T-1 rejects an invalid area code', () => {
    const areaCode = new AreaCodeModel({
      state: 'CA',
      codes: ['40'],
    });
    expect(areaCode.validateSync()).toBeDefined();
  });

  it('SCRUM-16-T-1 converts lowercase state codes to uppercase', () => {
    const areaCode = new AreaCodeModel({
      state: 'ca',
      codes: ['408'],
    });
    expect(areaCode.state).toBe('CA');
    expect(areaCode.validateSync()).toBeUndefined();
  });

  it('SCRUM-16-T-1 defines a unique index for state codes', () => {
    const statePath = AreaCodeModel.schema.path('state');
    expect(statePath.options.unique).toBe(true);
  });
});

// Criterion 2:
// The seed script was verified separately through a successful MongoDB run.
// It seeded CA, AZ, FL, IL, NY, TX, and WA into the stateAreaCodes collection.
// This is an integration verification, not an offline unit test.

// Criterion 3:
// California numbers with local and regional area codes are compliant.
describe('evaluatePhoneAreaCode - California area codes', () => {
  it('SCRUM-16-T-1 accepts California area code 831', async () => {
    const result = await evaluatePhoneAreaCode('8315550199');
    expect(result).toEqual({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Phone area code matches listing region',
        areaCode: '831',
      },
    });
    expect(findOneMock).toHaveBeenCalledWith({ state: 'CA' });
  });

  it('SCRUM-16-T-1 accepts California area code 408', async () => {
    const result = await evaluatePhoneAreaCode('4085550199', 'CA');
    expect(result).toEqual({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Phone area code matches listing region',
        areaCode: '408',
      },
    });
  });

  it('SCRUM-16-T-1 accepts California area code 650', async () => {
    const result = await evaluatePhoneAreaCode('6505550199', 'CA');
    expect(result).toEqual({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Phone area code matches listing region',
        areaCode: '650',
      },
    });
  });
});

// Criterion 4:
// Toll-free prefixes are compliant and do not require a database lookup.
describe('evaluatePhoneAreaCode - toll-free numbers', () => {
  it.each(['800', '888', '877', '866', '855', '844', '833'])(
    'SCRUM-16-T-1 accepts toll-free prefix %s without a database lookup',
    async (prefix) => {
      const result = await evaluatePhoneAreaCode(`${prefix}5550199`);
      expect(result).toEqual({
        success: true,
        data: {
          status: 'compliant',
          flag: null,
          message: 'Commercial toll-free phone number',
          areaCode: prefix,
        },
      });
      expect(findOneMock).not.toHaveBeenCalled();
    },
  );
});

// Criterion 5:
// Out-of-state area codes return a warning and NON_LOCAL_AREA_CODE.
describe('evaluatePhoneAreaCode - out-of-state area codes', () => {
  it.each(['305', '212', '512', '206'])(
    'SCRUM-16-T-1 flags out-of-state area code %s',
    async (areaCode) => {
      const result = await evaluatePhoneAreaCode(`${areaCode}5550199`, 'CA');
      expect(result).toEqual({
        success: true,
        data: {
          status: 'warning',
          flag: 'NON_LOCAL_AREA_CODE',
          message: `Phone area code (${areaCode}) does not match listing state (CA)`,
          areaCode,
        },
      });
    },
  );
});

// Criterion 6:
// Phone normalization supports parentheses, country-code prefixes, spaces,
// and periods.
describe('evaluatePhoneAreaCode - phone normalization', () => {
  it('SCRUM-16-T-1 normalizes a phone number with parentheses', async () => {
    const result = await evaluatePhoneAreaCode('(831) 555-0199', 'CA');
    expect(result).toMatchObject({
      success: true,
      data: {
        status: 'compliant',
        areaCode: '831',
      },
    });
  });

  it('SCRUM-16-T-1 normalizes a phone number with a country code', async () => {
    const result = await evaluatePhoneAreaCode('+1 831 555 0199', 'CA');
    expect(result).toMatchObject({
      success: true,
      data: {
        status: 'compliant',
        areaCode: '831',
      },
    });
  });

  it('SCRUM-16-T-1 normalizes a phone number with periods', async () => {
    const result = await evaluatePhoneAreaCode('831.555.0199', 'CA');
    expect(result).toMatchObject({
      success: true,
      data: {
        status: 'compliant',
        areaCode: '831',
      },
    });
  });
});

// Criterion 7:
// Missing, empty, whitespace-only, and incorrectly sized phone numbers
// are skipped without querying MongoDB.
describe('evaluatePhoneAreaCode - missing phone numbers', () => {
  it('SCRUM-16-T-1 skips an empty phone number', async () => {
    const result = await evaluatePhoneAreaCode('');
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Phone number not specified; check skipped',
        areaCode: null,
      },
    });
    expect(findOneMock).not.toHaveBeenCalled();
  });

  it('SCRUM-16-T-1 skips a whitespace-only phone number', async () => {
    const result = await evaluatePhoneAreaCode('   ');
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Phone number not specified; check skipped',
        areaCode: null,
      },
    });
    expect(findOneMock).not.toHaveBeenCalled();
  });

  it('SCRUM-16-T-1 skips a null phone number', async () => {
    const result = await evaluatePhoneAreaCode(null);
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Phone number not specified; check skipped',
        areaCode: null,
      },
    });
    expect(findOneMock).not.toHaveBeenCalled();
  });

  it('SCRUM-16-T-1 skips an undefined phone number', async () => {
    const result = await evaluatePhoneAreaCode(undefined);
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Phone number not specified; check skipped',
        areaCode: null,
      },
    });
    expect(findOneMock).not.toHaveBeenCalled();
  });

  it('SCRUM-16-T-1 skips a phone number that does not normalize to 10 digits', async () => {
    const result = await evaluatePhoneAreaCode('12345');
    expect(result).toEqual({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Phone number format invalid; check skipped',
        areaCode: null,
      },
    });
    expect(findOneMock).not.toHaveBeenCalled();
  });
});

// Criterion 8:
// Non-string phone inputs return an invalid-input failure envelope.
// Additional schema validation coverage is included here.
describe('evaluatePhoneAreaCode - invalid phone inputs', () => {
  it.each([1234567890, true, { phone: '8315550199' }])(
    'SCRUM-16-T-1 rejects a non-string phone input',
    async (phone) => {
      const result = await evaluatePhoneAreaCode(phone);
      expect(result).toEqual({
        success: false,
        error: 'Invalid phone input parameter',
      });
      expect(findOneMock).not.toHaveBeenCalled();
    },
  );

  it('SCRUM-16-T-1 validates the optional phone input schema', () => {
    expect(PhoneFlagInputSchema.safeParse('8315550199').success).toBe(true);
    expect(PhoneFlagInputSchema.safeParse('').success).toBe(true);
    expect(PhoneFlagInputSchema.safeParse(null).success).toBe(true);
    expect(PhoneFlagInputSchema.safeParse(undefined).success).toBe(true);
    expect(PhoneFlagInputSchema.safeParse(1234567890).success).toBe(false);
  });
});

// Criterion 9:
// Missing state mappings and database query failures return failure envelopes
// without throwing unhandled exceptions.
describe('evaluatePhoneAreaCode - database errors', () => {
  it('SCRUM-16-T-1 returns a failure when the target state mapping is missing', async () => {
    findOneMock.mockResolvedValueOnce(null);
    const result = await evaluatePhoneAreaCode('8315550199', 'CA');
    expect(result).toEqual({
      success: false,
      error: 'Area codes not found for state CA',
    });
  });

  it('SCRUM-16-T-1 returns a failure when the database query throws', async () => {
    findOneMock.mockRejectedValueOnce(new Error('Database connection failed'));
    const result = await evaluatePhoneAreaCode('8315550199', 'CA');
    expect(result).toEqual({
      success: false,
      error: 'Failed to evaluate phone area code',
    });
  });
});

// Criterion 10:
// Target state values are normalized to uppercase before querying.
// California is also the default target state when none is supplied.
describe('evaluatePhoneAreaCode - target state handling', () => {
  it('SCRUM-16-T-1 converts a lowercase target state to uppercase', async () => {
    await evaluatePhoneAreaCode('8315550199', 'ca');
    expect(findOneMock).toHaveBeenCalledWith({ state: 'CA' });
  });

  it('SCRUM-16-T-1 uses California as the default target state', async () => {
    await evaluatePhoneAreaCode('8315550199');
    expect(findOneMock).toHaveBeenCalledWith({ state: 'CA' });
  });
});

// Criterion 11:
// International phone numbers with a leading "+" and a non-U.S.
// country calling code return an international warning without
// querying U.S. state area-code mappings.
describe('evaluatePhoneAreaCode - international phone numbers', () => {
  it.each(['+44 20 7946 0958', '+61 2 9374 4000'])(
    'SCRUM-16-T-1 flags international phone number %s',
    async (phone) => {
      const result = await evaluatePhoneAreaCode(phone, 'CA');
      expect(result).toEqual({
        success: true,
        data: {
          status: 'warning',
          flag: 'INTERNATIONAL_PHONE_NUMBER',
          message:
            'International phone number; country is outside the supported U.S. area-code mappings',
          areaCode: null,
        },
      });
      expect(findOneMock).not.toHaveBeenCalled();
    },
  );
});
