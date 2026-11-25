---
id: SCRUM-16-T-2
story: SCRUM-16
sprint: 4
assignee: Adan Magana
estimate_hours: 5
---

# Detect obfuscated contact numbers in listing descriptions

## Description

Serves SCRUM-16 (detect contact anomalies and disguised contact details). This task implements a description-scanning service used to identify potentially suspicious rental listing descriptions containing disguised phone numbers. The service detects spelled-out digit words and leetspeak character substitutions commonly used by scammers to evade automated platform anti-fraud filters. It also provides phone number extraction as a fallback when a listing's dedicated phone input is blank, allowing embedded phone numbers to be passed to the area code checker. Missing or unusable descriptions are skipped, and ordinary descriptive prose containing number words is not flagged. Out of scope: MongoDB model and area code database querying (SCRUM-16-T-1), HTTP route integration, and frontend results UI.

## Specs

- Define ContactObfuscationInputSchema in server/src/services/contactObfuscation.service.ts using z.string().trim().nullish().

- Export the derived ContactObfuscationInput type using z.infer<typeof ContactObfuscationInputSchema>.

- Implement detectObfuscatedContact(description).

- Validate description inputs using ContactObfuscationInputSchema.safeParse().

- If the input is not a string, null, or undefined, return { success: false, error: 'Invalid description input parameter' }.

- If the description is missing, null, undefined, empty, or whitespace-only, return { success: true, data: { status: 'skipped', flag: null, message: 'Description not provided; check skipped', evidence: null } }.

- Detect spelled-out phone digits:
  - Recognize the number words zero through nine, as well as oh, as digit representations.
  - Detect a contiguous sequence containing at least seven decoded digits, with at least one digit represented by a spelled-out number word. Numeric digit groups and spelled-out digits may be mixed.
  - Allow digits to be separated only by spaces or punctuation.
  - Examples include eight three one five five five zero one nine nine and eight three one - five five five - 0199.

- Detect leetspeak substitutions in phone-shaped patterns:
  - Recognize O or o as a substitution for 0.
  - Recognize I or i as a substitution for 1.
  - Detect phone-shaped patterns containing these substitutions, such as 831-555-O199 and 83I-555-0199.
  - Do not flag ordinary words or descriptive prose merely because they contain letters that resemble digits.

- Store number word mappings and regex patterns in modular constants near the top of the service file.

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

- Support the specified spelled-out digit words, punctuation separators, and leetspeak substitutions.

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

1. A description containing at least seven consecutive spelled-out phone digits, such as eight three one five five five zero one nine nine, returns status violation and flag OBFUSCATED_CONTACT, with the matched snippet provided as evidence.

2. A description containing a sequence of spelled-out and numeric digits separated by spaces or punctuation, such as eight three one - five five five - 0199, returns status violation and flag OBFUSCATED_CONTACT.

3. A description containing leetspeak character substitutions in a phone-shaped pattern, such as 831-555-O199 or 83I-555-0199, returns status violation and flag OBFUSCATED_CONTACT.

4. Natural descriptive prose containing number words, such as two bedrooms in three weeks or five minutes walk to campus, returns status compliant and flag null.

5. extractPhoneFromDescription(description) extracts the first standard numeric 10-digit phone number candidate from description text, including commonly formatted phone numbers, or returns null when no qualifying phone number is found.

6. Missing descriptions (undefined, null, empty strings, or whitespace-only strings) return status skipped and flag null.

7. Non-string inputs, including numbers, booleans, and objects, return { success: false, error: 'Invalid description input parameter' } without crashing the process.

8. The service supports at least four obfuscated scam description samples and correctly identifies their disguised phone-number patterns.

9. The service does not flag at least three clean descriptive prose samples that contain ordinary number words without phone-number patterns.

## Tests

File: server/tests/SCRUM-16-T-2_contactObfuscation.test.ts

Setup for all: Offline unit tests directly invoking the exported description obfuscation detection and phone extraction functions. The service is pure and does not require a live MongoDB connection or external services.

- Criterion 1: Tests spelled-out digit sequences containing at least seven number words, including eight three one five five five zero one nine nine, and asserts status violation, flag OBFUSCATED_CONTACT, and the matched snippet as evidence.

- Criterion 2: Tests mixed spelled-out and numeric digit sequences separated by spaces or punctuation, including eight three one - five five five - 0199, and asserts status violation and the expected evidence.

- Criterion 3: Tests leetspeak phone patterns such as 831-555-O199 and 83I-555-0199, asserting status violation and flag OBFUSCATED_CONTACT.

- Criterion 4: Tests clean descriptive prose such as two bedrooms in three weeks and five minutes walk to campus, asserting status compliant, flag null, and evidence null.

- Criterion 5: Tests extraction of a standard 10-digit phone number, a formatted phone number, and a description without an extractable phone number, asserting the expected phone string or null.

- Criterion 6: Tests empty, whitespace-only, null, and undefined descriptions, asserting status skipped, flag null, and the missing-description message.

- Criterion 7: Tests numeric, boolean, and object description inputs, asserting { success: false, error: 'Invalid description input parameter' } without throwing exceptions.

- Criterion 8: Includes at least four distinct obfuscated scam description samples and verifies that each is detected.

- Criterion 9: Includes at least three distinct clean descriptive prose samples and verifies that none are flagged.

Error handling: Tests malformed input values and missing descriptions to verify that the service returns the expected response envelopes without throwing unhandled exceptions.
