---
id: SCRUM-16-T-2
story: SCRUM-16
sprint: 4
assignee: Adan Magana
estimate_hours: 5
---

# Detect obfuscated contact numbers in listing descriptions

## Description

Serves SCRUM-16 (detect contact anomalies and disguised contact details). This task implements a description-scanning service used to identify potentially suspicious rental listing descriptions containing disguised phone numbers. The service detects spelled-out digit words, compound number words, number sequences connected by words such as "and", and leetspeak character substitutions commonly used by scammers to evade automated platform anti-fraud filters.

The detector supports individual digit words, tens-based compound numbers (such as "thirty one" and "fifty five"), and mixed numeric and spelled-out sequences. It requires at least seven decoded digits and at least two spelled-out number words in a matched sequence to reduce false positives from ordinary prose, dates, and numeric phone numbers followed by an unrelated number word.

The service also provides phone number extraction as a fallback when a listing's dedicated phone input is blank, allowing embedded phone numbers to be passed to the area code checker. Missing or unusable descriptions are skipped, and ordinary descriptive prose containing number words is not flagged. Out of scope: MongoDB model and area code database querying (SCRUM-16-T-1), HTTP route integration, and frontend results UI.

## Specs

- Define ContactObfuscationInputSchema in server/src/services/contactObfuscation.service.ts using z.string().trim().nullish().

- Export the derived ContactObfuscationInput type using z.infer<typeof ContactObfuscationInputSchema>.

- Implement detectObfuscatedContact(description).

- Validate description inputs using ContactObfuscationInputSchema.safeParse().

- If the input is not a string, null, or undefined, return { success: false, error: 'Invalid description input parameter' }.

- If the description is missing, null, undefined, empty, or whitespace-only, return { success: true, data: { status: 'skipped', flag: null, message: 'Description not provided; check skipped', evidence: null } }.

- Detect spelled-out phone digits and compound number sequences:
  - Recognize the number words zero through nine, as well as oh, as digit representations.
  - Recognize tens words twenty, thirty, forty, fifty, sixty, seventy, eighty, and ninety.
  - Decode compound numbers by combining a tens word with a following single-digit word, such as "thirty one" as 31 and "fifty five" as 55.
  - Allow the word "and" to connect number words within a sequence.
  - Detect a contiguous sequence containing at least seven decoded digits and at least two spelled-out number words. Numeric digit groups and spelled-out numbers may be mixed.
  - Allow digits and number words to be separated by spaces or punctuation, including commas and hyphens.
  - Examples include:
    - eight three one five five five zero one nine nine
    - eight three one - five five five - 0199
    - eight thirty one, five fifty five, zero one nine nine
    - eight and thirty one, five and fifty five, zero one nine nine
    - eight thirty-one, five fifty-five, zero one nine nine
  - Require at least two spelled-out number words to reduce false positives from ordinary prose, dates, and numeric phone numbers followed by a single unrelated number word.

- Detect leetspeak substitutions in phone-shaped patterns:
  - Recognize O or o as a substitution for 0.
  - Recognize I or i as a substitution for 1.
  - Detect phone-shaped patterns containing these substitutions, such as 831-555-O199 and 83I-555-0199.
  - Do not flag ordinary words or descriptive prose merely because they contain letters that resemble digits.

- Store individual digit mappings, tens-word mappings, and regex patterns in modular constants near the top of the service file.

- If obfuscation is detected, return { success: true, data: { status: 'violation', flag: 'OBFUSCATED_CONTACT', message: 'Description contains disguised contact numbers to bypass platform anti-fraud filters', evidence: matchedSnippet } }.

- The evidence field contains the matched portion of the description that triggered the violation.

- If no obfuscation is detected, return { success: true, data: { status: 'compliant', flag: null, message: 'No contact obfuscation detected in description', evidence: null } }.

- Also export extractPhoneFromDescription(description).

- The extraction function identifies the first standard numeric 10-digit phone number candidate found in the description, including common formatting such as parentheses, spaces, periods, and hyphens.

- The extraction function returns the extracted phone number as a string, or null if no qualifying phone number is found.

- The extraction function does not perform database lookups or phone area-code classification.

- Keep obfuscation detection and phone extraction as separate operations.

- Successful detection evaluations return the standardized envelope { success: true, data: { status, flag, message, evidence } }.

## Requirements

- Implement the service in server/src/services/contactObfuscation.service.ts.

- Use Zod for description input validation and derive the input type using z.infer.

- Implement detectObfuscatedContact(description) and extractPhoneFromDescription(description) as exported functions.

- Keep the service pure, with no network calls, database access, or other external side effects.

- Use modular constants for number word mappings and regular expression patterns.

- Support individual spelled-out digit words, tens-based compound numbers, "and" connectors, punctuation separators, mixed numeric and spelled-out sequences, and leetspeak substitutions.

- Require at least seven decoded digits and at least two spelled-out number words in a detected sequence to reduce false positives.

- Avoid flagging normal descriptive prose that contains number words without a phone-like sequence.

- Follow existing repository conventions for service response envelopes and TypeScript types.

- Use Vitest for unit tests.

- All unit tests must be located in server/tests/SCRUM-16-T-2_contactObfuscation.test.ts.

- Include at least four obfuscated scam description samples and three clean descriptive prose samples.

- Test standard phone extraction, formatted phone extraction, and descriptions without an extractable phone number.

- Test missing descriptions, invalid input types, and whitespace-only descriptions.

- Do not introduce unnecessary runtime dependencies.

- Preserve existing functionality and ensure existing tests continue passing.

- Every acceptance criterion must have at least one committed test.

## Acceptance criteria

1. A description containing at least seven decoded phone digits represented by spelled-out number words, such as eight three one five five five zero one nine nine, returns status violation and flag OBFUSCATED_CONTACT, with the matched snippet provided as evidence.

2. A description containing a sequence of spelled-out and numeric digits separated by spaces or punctuation, such as eight three one - five five five - 0199, returns status violation and flag OBFUSCATED_CONTACT.

3. A description containing compound number words, such as eight thirty one, five fifty five, or sequences connected by "and", returns status violation when the decoded sequence meets the detection threshold.

4. A description containing leetspeak character substitutions in a phone-shaped pattern, such as 831-555-O199 or 83I-555-0199, returns status violation and flag OBFUSCATED_CONTACT.

5. Natural descriptive prose containing number words, such as two bedrooms in three weeks or five minutes walk to campus, returns status compliant and flag null.

6. A numeric phone number followed by a single unrelated number word, such as "Call 831-555-0199, one of our agents will help", does not trigger an obfuscation violation.

7. A date followed by a single unrelated number word, such as "Available 12/01/2025, one bedroom left", does not trigger an obfuscation violation.

8. extractPhoneFromDescription(description) extracts the first standard numeric 10-digit phone number candidate from description text, including commonly formatted phone numbers, or returns null when no qualifying phone number is found.

9. Missing descriptions (undefined, null, empty strings, or whitespace-only strings) return status skipped and flag null.

10. Non-string inputs, including numbers, booleans, and objects, return { success: false, error: 'Invalid description input parameter' } without crashing the process.

11. The service supports at least four distinct obfuscated scam description samples and correctly identifies their disguised phone-number patterns.

12. The service does not flag at least three distinct clean descriptive prose samples and correctly handles the date and numeric-phone false-positive examples.

## Tests

File: server/tests/SCRUM-16-T-2_contactObfuscation.test.ts

Setup for all: Offline unit tests directly invoking the exported description obfuscation detection and phone extraction functions. The service is pure and does not require a live MongoDB connection or external services.

- Criterion 1: Tests spelled-out digit sequences containing at least seven decoded digits and at least two spelled-out number words, including eight three one five five five zero one nine nine, and asserts status violation, flag OBFUSCATED_CONTACT, and the matched snippet as evidence.

- Criterion 2: Tests mixed spelled-out and numeric digit sequences separated by spaces or punctuation, including eight three one - five five five - 0199, and asserts status violation and the expected evidence.

- Criterion 3: Tests compound number words and sequences connected by "and", including eight thirty one, five fifty five and eight and thirty one, five and fifty five. Also tests hyphenated compound number words.

- Criterion 4: Tests leetspeak phone patterns such as 831-555-O199 and 83I-555-0199, asserting status violation and flag OBFUSCATED_CONTACT.

- Criterion 5: Tests clean descriptive prose such as two bedrooms in three weeks and five minutes walk to campus, asserting status compliant, flag null, and evidence null.

- Criterion 6: Tests a numeric phone number followed by a single unrelated number word, such as "Call 831-555-0199, one of our agents will help", and asserts that it remains compliant.

- Criterion 7: Tests a date followed by a single unrelated number word, such as "Available 12/01/2025, one bedroom left", and asserts that it remains compliant.

- Criterion 8: Tests extraction of a standard 10-digit phone number, a formatted phone number, and a description without an extractable phone number, asserting the expected phone string or null.

- Criterion 9: Tests empty, whitespace-only, null, and undefined descriptions, asserting status skipped, flag null, and the missing-description message.

- Criterion 10: Tests numeric, boolean, and object description inputs, asserting { success: false, error: 'Invalid description input parameter' } without throwing exceptions.

- Criterion 11: Includes at least four distinct obfuscated scam description samples and verifies that each is detected.

- Criterion 12: Includes at least three distinct clean descriptive prose samples and verifies that none are flagged, including the date and numeric-phone false-positive examples.

Error handling: Tests malformed input values and missing descriptions to verify that the service returns the expected response envelopes without throwing unhandled exceptions.
