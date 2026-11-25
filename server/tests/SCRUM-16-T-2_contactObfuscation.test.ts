import { describe, expect, it } from 'vitest';
import {
  ContactObfuscationInputSchema,
  detectObfuscatedContact,
  extractPhoneFromDescription,
} from '../src/services/contactObfuscation.service.js';

// Criterion 1:
// Spelled-out sequences containing at least seven digits are violations.
// The matched sequence is returned as evidence.
describe('detectObfuscatedContact - spelled-out numbers', () => {
  it('SCRUM-16-T-2 detects a 10-digit spelled-out phone number', () => {
    const result = detectObfuscatedContact(
      'Call me at eight three one five five five zero one nine nine',
    );

    expect(result).toEqual({
      success: true,
      data: {
        status: 'violation',
        flag: 'OBFUSCATED_CONTACT',
        message:
          'Description contains disguised contact numbers to bypass platform anti-fraud filters',
        evidence: 'eight three one five five five zero one nine nine',
      },
    });
  });

  it('SCRUM-16-T-2 detects a sequence containing exactly seven spelled-out digits', () => {
    const result = detectObfuscatedContact('Contact me at eight three one five five five zero');

    expect(result).toMatchObject({
      success: true,
      data: {
        status: 'violation',
        flag: 'OBFUSCATED_CONTACT',
        evidence: 'eight three one five five five zero',
      },
    });
  });

  it('SCRUM-16-T-2 detects a spelled-out number separated by punctuation', () => {
    const result = detectObfuscatedContact(
      'Contact me at eight three one - five five five - zero one nine nine',
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        status: 'violation',
        flag: 'OBFUSCATED_CONTACT',
        evidence: 'eight three one - five five five - zero one nine nine',
      },
    });
  });
});

// Criterion 2:
// Mixed spelled-out and numeric digits separated by spaces or punctuation
// are detected as disguised contact numbers.
describe('detectObfuscatedContact - mixed number sequences', () => {
  it('SCRUM-16-T-2 detects a sequence mixing spelled-out and numeric digits', () => {
    const result = detectObfuscatedContact('My number is eight three one - five five five - 0199');

    expect(result).toMatchObject({
      success: true,
      data: {
        status: 'violation',
        flag: 'OBFUSCATED_CONTACT',
        evidence: 'eight three one - five five five - 0199',
      },
    });
  });

  it('SCRUM-16-T-2 detects another mixed spelled-out and numeric sequence', () => {
    const result = detectObfuscatedContact('Reach me at 831 five five five 0199');

    expect(result).toMatchObject({
      success: true,
      data: {
        status: 'violation',
        flag: 'OBFUSCATED_CONTACT',
        evidence: '831 five five five 0199',
      },
    });
  });
});

// Criterion 3:
// Phone-shaped sequences using O/o for zero and I/i for one
// are detected as disguised contact numbers.
describe('detectObfuscatedContact - leetspeak numbers', () => {
  it.each(['831-555-O199', '83I-555-0199'])(
    'SCRUM-16-T-2 detects leetspeak phone number %s',
    (phone) => {
      const result = detectObfuscatedContact(`Contact me at ${phone}`);

      expect(result).toMatchObject({
        success: true,
        data: {
          status: 'violation',
          flag: 'OBFUSCATED_CONTACT',
          evidence: phone,
        },
      });
    },
  );
});

// Criterion 4:
// Natural prose containing number words must remain compliant.
describe('detectObfuscatedContact - clean descriptions', () => {
  it.each([
    'The apartment has one bedroom and two bathrooms.',
    'The property is three blocks from the park and five minutes from downtown.',
    'There are two parking spaces, a large kitchen, and four windows in the living room.',
  ])('SCRUM-16-T-2 accepts natural prose without disguised contact numbers', (description) => {
    const result = detectObfuscatedContact(description);

    expect(result).toEqual({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'No contact obfuscation detected in description',
        evidence: null,
      },
    });
  });

  it('SCRUM-16-T-2 does not flag an ordinary numeric phone number as obfuscated', () => {
    const result = detectObfuscatedContact('Call me at (831) 555-0199 for more information.');

    expect(result).toMatchObject({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        evidence: null,
      },
    });
  });
});

// Criterion 5:
// The extraction function returns the first ordinary 10-digit phone
// number in a description, or null when no number is present.
describe('extractPhoneFromDescription', () => {
  it('SCRUM-16-T-2 extracts an unformatted 10-digit phone number', () => {
    const result = extractPhoneFromDescription('Call me at 8315550199 for more information.');

    expect(result).toBe('8315550199');
  });

  it('SCRUM-16-T-2 extracts a phone number with parentheses and hyphens', () => {
    const result = extractPhoneFromDescription('Contact me at (831) 555-0199.');

    expect(result).toBe('(831) 555-0199');
  });

  it('SCRUM-16-T-2 extracts a phone number with periods', () => {
    const result = extractPhoneFromDescription('My number is 831.555.0199.');

    expect(result).toBe('831.555.0199');
  });

  it('SCRUM-16-T-2 extracts a phone number with a US country code', () => {
    const result = extractPhoneFromDescription('Call +1 831 555 0199.');

    expect(result).toBe('+1 831 555 0199');
  });

  it('SCRUM-16-T-2 extracts a phone number with a bare US country code', () => {
    const result = extractPhoneFromDescription('Call 1 831 555 0199.');

    expect(result).toBe('1 831 555 0199');
  });

  it('SCRUM-16-T-2 extracts the first phone number when multiple are present', () => {
    const result = extractPhoneFromDescription('Call 8315550199 or 4085550123.');

    expect(result).toBe('8315550199');
  });

  it('SCRUM-16-T-2 returns null when no phone number is present', () => {
    const result = extractPhoneFromDescription(
      'This apartment has a spacious kitchen and two bedrooms.',
    );

    expect(result).toBeNull();
  });
});

// Criterion 6:
// Missing, empty, whitespace-only, null, and undefined descriptions
// are skipped.
describe('detectObfuscatedContact - missing descriptions', () => {
  it.each(['', '   ', null, undefined])(
    'SCRUM-16-T-2 skips an empty or missing description',
    (description) => {
      const result = detectObfuscatedContact(description);

      expect(result).toEqual({
        success: true,
        data: {
          status: 'skipped',
          flag: null,
          message: 'Description not provided; check skipped',
          evidence: null,
        },
      });
    },
  );
});

// Criterion 7:
// Non-string description inputs return an invalid-input failure envelope.
describe('detectObfuscatedContact - invalid descriptions', () => {
  it.each([123, true, { description: '8315550199' }])(
    'SCRUM-16-T-2 rejects a non-string description input',
    (description) => {
      const result = detectObfuscatedContact(description);

      expect(result).toEqual({
        success: false,
        error: 'Invalid description input parameter',
      });
    },
  );

  it('SCRUM-16-T-2 validates the optional description input schema', () => {
    expect(ContactObfuscationInputSchema.safeParse('A nice apartment').success).toBe(true);
    expect(ContactObfuscationInputSchema.safeParse('').success).toBe(true);
    expect(ContactObfuscationInputSchema.safeParse(null).success).toBe(true);
    expect(ContactObfuscationInputSchema.safeParse(undefined).success).toBe(true);
    expect(ContactObfuscationInputSchema.safeParse(123).success).toBe(false);
  });
});

// Criterion 8:
// At least four distinct disguised contact-number examples are tested.
//
// Covered by the spelled-out, mixed-sequence, and leetspeak test groups above.

// Criterion 9:
// At least three clean listing-description examples are tested.
//
// Covered by the clean descriptions test group above.
