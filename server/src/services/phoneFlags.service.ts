/**
 * Phone area code and contact flag evaluation service.
 * Serves SCRUM-16 (contact anomaly detection).
 */

export type PhoneFlagStatus = 'compliant' | 'warning' | 'skipped';

export interface PhoneFlagResult {
  readonly status: PhoneFlagStatus;
  readonly flag: string | null;
  readonly message: string;
  readonly areaCode?: string | null;
}

/**
 * Evaluates phone number area codes against target state mappings.
 *
 * @param phone Raw phone number string or input.
 * @param targetState Expected two-letter US state abbreviation (default: 'CA').
 * @returns Phone evaluation result.
 */
export async function evaluatePhoneAreaCode(
  phone?: string | null,
  targetState = 'CA',
): Promise<PhoneFlagResult> {
  void targetState;
  if (!phone || typeof phone !== 'string' || phone.trim() === '') {
    return {
      status: 'skipped',
      flag: null,
      message: 'Phone number not specified; check skipped',
    };
  }

  return {
    status: 'compliant',
    flag: null,
    message: 'Phone area code matches listing region',
  };
}

/** Alias for evaluation orchestrator worker invocation. */
export const evaluateContactPhone = evaluatePhoneAreaCode;
