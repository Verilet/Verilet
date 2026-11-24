import { z } from 'zod';
import { AreaCodeModel } from '../models/areaCode.model.js';

/** Schema for an optional phone number. */
export const PhoneFlagInputSchema = z.string().trim().nullish();

/** Automatically derives the input type from the schema. */
export type PhoneFlagInput = z.infer<typeof PhoneFlagInputSchema>;

export type PhoneFlagStatus = 'compliant' | 'warning' | 'skipped';

export type PhoneFlag = 'NON_LOCAL_AREA_CODE' | 'INTERNATIONAL_PHONE_NUMBER' | null;

/** Phone classification result data. */
export interface PhoneFlagData {
  status: PhoneFlagStatus;
  flag: PhoneFlag;
  message: string;
  areaCode: string | null;
}

/** Result envelope for phone classification. */
export type PhoneFlagResult =
  | { readonly success: true; readonly data: PhoneFlagData }
  | { readonly success: false; readonly error: string };

/** Toll-free prefixes that do not represent a local geographic area. */
const TOLL_FREE_PREFIXES = new Set(['800', '888', '877', '866', '855', '844', '833']);

/** Creates a skipped phone classification result. */
function skippedResult(message: string): PhoneFlagResult {
  return {
    success: true,
    data: {
      status: 'skipped',
      flag: null,
      message,
      areaCode: null,
    },
  };
}

/**
 * Evaluates whether a phone number's area code matches the listing state.
 *
 * @param phone Optional phone number to evaluate.
 * @param targetState State associated with the listing.
 * @returns A phone classification result.
 */
export async function evaluatePhoneAreaCode(
  phone?: unknown,
  targetState = 'CA',
): Promise<PhoneFlagResult> {
  const parsed = PhoneFlagInputSchema.safeParse(phone);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid phone input parameter',
    };
  }
  if (parsed.data === null || parsed.data === undefined || parsed.data === '') {
    return skippedResult('Phone number not specified; check skipped');
  }
  if (parsed.data.startsWith('+') && !parsed.data.startsWith('+1')) {
    return {
      success: true,
      data: {
        status: 'warning',
        flag: 'INTERNATIONAL_PHONE_NUMBER',
        message:
          'International phone number; country is outside the supported U.S. area-code mappings',
        areaCode: null,
      },
    };
  }

  // Remove formatting characters, leaving only digits
  let digits = parsed.data.replace(/\D/g, '');

  // Remove the US country code when the number has 11 digits
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }

  if (digits.length !== 10) {
    return skippedResult('Phone number format invalid; check skipped');
  }

  const areaCode = digits.slice(0, 3);

  // Toll-free numbers do not need a geographic area-code lookup
  if (TOLL_FREE_PREFIXES.has(areaCode)) {
    return {
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Commercial toll-free phone number',
        areaCode,
      },
    };
  }
  try {
    const state = targetState.toUpperCase();
    const stateAreaCodes = await AreaCodeModel.findOne({ state });
    if (!stateAreaCodes) {
      return {
        success: false,
        error: `Area codes not found for state ${state}`,
      };
    }
    const codes = new Set(stateAreaCodes.codes);
    if (codes.has(areaCode)) {
      return {
        success: true,
        data: {
          status: 'compliant',
          flag: null,
          message: 'Phone area code matches listing region',
          areaCode,
        },
      };
    }
    return {
      success: true,
      data: {
        status: 'warning',
        flag: 'NON_LOCAL_AREA_CODE',
        message: `Phone area code (${areaCode}) does not match listing state (${targetState})`,
        areaCode,
      },
    };
  } catch {
    return {
      success: false,
      error: 'Failed to evaluate phone area code',
    };
  }
}
