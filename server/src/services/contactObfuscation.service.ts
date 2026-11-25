import { z } from 'zod';

/** Schema for an optional listing description. */
export const ContactObfuscationInputSchema = z.string().trim().nullish();

/** Automatically derives the input type from the schema. */
export type ContactObfuscationInput = z.infer<typeof ContactObfuscationInputSchema>;

export type ContactObfuscationStatus = 'violation' | 'compliant' | 'skipped';

export type ContactObfuscationFlag = 'OBFUSCATED_CONTACT' | null;

/** Contact obfuscation result data. */
export interface ContactObfuscationData {
  status: ContactObfuscationStatus;
  flag: ContactObfuscationFlag;
  message: string;
  evidence: string | null;
}

/** Result envelope for contact obfuscation detection. */
export type ContactObfuscationResult =
  | { readonly success: true; readonly data: ContactObfuscationData }
  | { readonly success: false; readonly error: string };

/** Words representing individual digits, including "oh" for zero. */
const NUMBER_WORDS = new Set([
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'oh',
]);

/** Pattern for a single spelled-out digit or numeric digit group. */
const NUMBER_TOKEN_PATTERN = '(?:zero|one|two|three|four|five|six|seven|eight|nine|oh|\\d+)';

/**
 * Matches sequences of spelled-out digits and/or numeric groups.
 * The sequence must contain at least two tokens; its decoded digit
 * count is checked separately.
 */
const NUMBER_SEQUENCE_REGEX = new RegExp(
  `(?<![A-Za-z0-9])${NUMBER_TOKEN_PATTERN}(?:[\\s.,;:()[\\]{}\\-/\\\\]+${NUMBER_TOKEN_PATTERN})+(?![A-Za-z0-9])`,
  'gi',
);

/**
 * Matches phone-shaped sequences that use O/o for zero or I/i for one.
 * At least one letter substitution is required by the detection logic.
 */
const LEETSPEAK_PHONE_REGEX =
  /(?<![A-Za-z0-9])[0-9OoIi]{3}[ .()-]*[0-9OoIi]{3}[ .()-]*[0-9OoIi]{4}(?![A-Za-z0-9])/g;

/** Matches ordinary 10-digit phone numbers, optionally with a US country code. */
const PHONE_NUMBER_REGEX =
  /(?<!\d)(?:\+?1[\s.-]?)?(?:\(\s*\d{3}\s*\)|\d{3})[\s.-]*\d{3}[\s.-]*\d{4}(?!\d)/;

/** Creates a skipped contact obfuscation result. */
function skippedResult(): ContactObfuscationResult {
  return {
    success: true,
    data: {
      status: 'skipped',
      flag: null,
      message: 'Description not provided; check skipped',
      evidence: null,
    },
  };
}

/** Creates a violation result with the matched text as evidence. */
function violationResult(evidence: string): ContactObfuscationResult {
  return {
    success: true,
    data: {
      status: 'violation',
      flag: 'OBFUSCATED_CONTACT',
      message:
        'Description contains disguised contact numbers to bypass platform anti-fraud filters',
      evidence,
    },
  };
}

/**
 * Checks whether a sequence contains at least seven decoded digits
 * and at least one spelled-out digit.
 */
function isObfuscatedNumberSequence(sequence: string): boolean {
  const tokens = sequence.match(/zero|one|two|three|four|five|six|seven|eight|nine|oh|\d+/gi);
  if (!tokens) {
    return false;
  }
  let digitCount = 0;
  let containsNumberWord = false;
  for (const token of tokens) {
    const normalizedToken = token.toLowerCase();
    if (NUMBER_WORDS.has(normalizedToken)) {
      digitCount += 1;
      containsNumberWord = true;
    } else {
      digitCount += token.length;
    }
  }
  return digitCount >= 7 && containsNumberWord;
}

/**
 * Detects disguised phone numbers in a listing description.
 *
 * @param description Optional listing description.
 * @returns A contact obfuscation result.
 */
export function detectObfuscatedContact(description?: unknown): ContactObfuscationResult {
  const parsed = ContactObfuscationInputSchema.safeParse(description);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid description input parameter',
    };
  }
  if (parsed.data === null || parsed.data === undefined || parsed.data === '') {
    return skippedResult();
  }
  const text = parsed.data;

  // Check for spelled-out or mixed spelled-out/numeric digit sequences
  const numberSequenceMatches = text.matchAll(NUMBER_SEQUENCE_REGEX);

  for (const match of numberSequenceMatches) {
    if (isObfuscatedNumberSequence(match[0])) {
      return violationResult(match[0]);
    }
  }

  // Check for phone-shaped sequences containing leetspeak substitutions
  const leetspeakMatches = text.matchAll(LEETSPEAK_PHONE_REGEX);

  for (const match of leetspeakMatches) {
    if (/[OoIi]/.test(match[0])) {
      return violationResult(match[0]);
    }
  }
  return {
    success: true,
    data: {
      status: 'compliant',
      flag: null,
      message: 'No contact obfuscation detected in description',
      evidence: null,
    },
  };
}

/**
 * Extracts the first ordinary phone number embedded in a description.
 *
 * @param description Listing description to search.
 * @returns The first matched phone number, or null if none is found.
 */
export function extractPhoneFromDescription(description?: unknown): string | null {
  if (typeof description !== 'string' || description.trim() === '') {
    return null;
  }
  const match = description.match(PHONE_NUMBER_REGEX);
  return match ? match[0] : null;
}
