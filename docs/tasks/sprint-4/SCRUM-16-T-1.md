---
id: SCRUM-16-T-1
story: SCRUM-16
sprint: 4
assignee: Adan Magana
estimate_hours: 6
---

# Classify phone numbers by geographic area code

## Description

Serves SCRUM-16 (detect contact anomalies and out-of-state listers). This task implements the MongoDB data layer and phone area code evaluation service used to identify potentially suspicious rental listing contact information. The service normalizes submitted US phone numbers and compares their area codes against state-specific mappings stored in MongoDB. It identifies local and regional California numbers, commercial toll-free numbers, and numbers originating outside the listing's target state. Missing or unusable phone numbers are skipped. Out of scope: description text obfuscation detection (SCRUM-16-T-2), HTTP route integration, and frontend results UI.

## Specs

- Create AreaCodeModel in server/src/models/areaCode.model.ts with:
  - state: required String containing an uppercase two-letter US state abbreviation, validated with /^[A-Z]{2}$/ and enforced with a unique index.
  - codes: required array of three-digit area code strings, with each element validated using /^\d{3}$/. The array defaults to undefined so a missing array fails required validation.

- Store the area code mappings in the MongoDB areaCodes database, using the stateAreaCodes collection.

- Create server/src/scripts/seedAreaCodes.ts to populate California area codes, including 831 and regional Bay Area codes, and mappings for common comparison states (AZ, FL, IL, NY, TX, and WA).

- Define PhoneFlagInputSchema in server/src/services/phoneFlags.service.ts using z.string().trim().nullish().

- Export the derived PhoneFlagInput type using z.infer<typeof PhoneFlagInputSchema>.

- Implement evaluatePhoneAreaCode(phone, targetState = 'CA').

- Validate phone inputs using PhoneFlagInputSchema.safeParse().

- If the input is not a string, null, or undefined, return { success: false, error: "Invalid phone input parameter" }.

- If the phone number is missing, null, undefined, empty, or whitespace-only, return { success: true, data: { status: "skipped", flag: null, message: "Phone number not specified; check skipped", areaCode: null } }.

- Normalize phone numbers by removing non-digit characters and stripping a leading US country code (1) from an 11-digit number.

- Phone numbers that cannot be normalized to exactly 10 digits return { success: true, data: { status: "skipped", flag: null, message: "Phone number format invalid; check skipped", areaCode: null } }.

- Check commercial toll-free prefixes (800, 888, 877, 866, 855, 844, 833) before querying MongoDB.

- Toll-free numbers return { success: true, data: { status: "compliant", flag: null, message: "Commercial toll-free phone number", areaCode: string } } without a database lookup.

- Query AreaCodeModel.findOne({ state: targetState.toUpperCase() }) and use the state's area code list to classify the number.

- Return the following classifications:
  - compliant: The number has an area code listed for the target state, or has a commercial toll-free prefix.
  - warning: The number has an area code not listed for the target state, with flag NON_LOCAL_AREA_CODE.
  - skipped: The phone number is missing or cannot be normalized to exactly 10 digits.

- Successful evaluations return the standardized envelope { success: true, data: { status, flag, message, areaCode } }.

- If the target state's area code mapping is missing, return { success: false, error: "Area codes not found for state STATE" }, using the requested uppercase state abbreviation.

- If the database query fails, return { success: false, error: "Failed to evaluate phone area code" } instead of throwing an unhandled exception.

- If targetState is omitted, the service evaluates the phone number against California (CA).

## Requirements

- Implement the Mongoose model in server/src/models/areaCode.model.ts.

- Implement the seed script in server/src/scripts/seedAreaCodes.ts.

- Implement the evaluation service in server/src/services/phoneFlags.service.ts.

- Use Mongoose for the AreaCodeModel and MongoDB queries.

- Use Zod for phone input validation and derive the input type using z.infer.

- Follow existing repository conventions for Mongoose models and service response envelopes.

- Use Vitest for unit tests.

- All unit tests must be located in server/tests/SCRUM-16-T-1_phoneFlags.test.ts.

- Mock Mongoose queries so unit tests run offline without requiring a live MongoDB connection.

- Do not introduce unnecessary runtime dependencies.

- Preserve existing functionality and ensure existing tests continue passing.

- Every acceptance criterion must have at least one committed test.

## Acceptance criteria

1. The AreaCodeModel enforces a required, unique, uppercase two-letter state code and a required array of valid three-digit area codes. Missing area-code arrays and invalid area-code entries fail schema validation.

2. Running the area code seed script populates the MongoDB areaCodes database's stateAreaCodes collection with California area codes, including 831 and regional Bay Area codes, and mappings for common comparison states.

3. A California phone number with a local or regional area code, such as 831, 408, or 650, returns status: "compliant" and flag: null.

4. A commercial toll-free phone number beginning with 800, 888, 877, 866, 855, 844, or 833 returns status: "compliant" and flag: null without querying MongoDB.

5. A phone number with an out-of-state area code, such as 305, 212, 512, or 206, returns status: "warning" and flag: "NON_LOCAL_AREA_CODE" when evaluated against California.

6. Phone number normalization correctly handles formatted inputs such as (831) 555-0199, +1 831 555 0199, and 831.555.0199.

7. Missing phone inputs (undefined, null, or an empty string) return status: "skipped" and flag: null. Inputs that cannot be normalized to exactly 10 digits also return status: "skipped" and flag: null.

8. Non-string inputs, including numbers, booleans, and objects, return { success: false, error: "Invalid phone input parameter" } without crashing the process.

9. Missing state mappings and MongoDB query failures return a failure envelope without producing unhandled exceptions.

10. The target state is normalized to uppercase before the database query, and California (CA) is used as the default target state when no target state is supplied.

## Tests

File: server/tests/SCRUM-16-T-1_phoneFlags.test.ts

Setup for all: Offline unit tests directly invoking the exported phone area code evaluation service with a mocked Mongoose findOne query. The same test file also validates the actual AreaCodeModel schema without requiring a live MongoDB connection.

- Criterion 1: SCRUM-16-T-1 accepts a valid state and area-code mapping, SCRUM-16-T-1 requires a state, SCRUM-16-T-1 requires area codes, SCRUM-16-T-1 rejects an invalid state format, SCRUM-16-T-1 rejects an invalid area code format, SCRUM-16-T-1 converts lowercase state abbreviations to uppercase, and SCRUM-16-T-1 defines a unique index on the state field — validates required fields, uppercase state normalization, state format, area-code format, and the unique state index.

- Criterion 2: The seed script server/src/scripts/seedAreaCodes.ts was executed against the MongoDB areaCodes database. It successfully seeded CA, AZ, FL, IL, NY, TX, and WA into the stateAreaCodes collection. This was verified through a successful database seeding run rather than an offline unit test.

- Criterion 3: SCRUM-16-T-1 returns compliant for California area code 831, SCRUM-16-T-1 returns compliant for California area code 408, and SCRUM-16-T-1 returns compliant for California area code 650 — mocks the California area-code mapping and asserts status "compliant", flag null, the expected message, and the extracted area code.

- Criterion 4: SCRUM-16-T-1 identifies toll-free numbers without querying MongoDB — evaluates all seven supported toll-free prefixes and asserts status "compliant", flag null, the toll-free message, the extracted area code, and that the database query is never called.

- Criterion 5: SCRUM-16-T-1 returns a warning for a non-local area code and SCRUM-16-T-1 identifies multiple out-of-state area codes — evaluates area codes 305, 212, 512, and 206 against California and asserts status "warning" and flag "NON_LOCAL_AREA_CODE".

- Criterion 6: SCRUM-16-T-1 normalizes formatted phone numbers — evaluates (831) 555-0199, +1 831 555 0199, and 831.555.0199, asserting that each is normalized and classified as a compliant California number.

- Criterion 7: SCRUM-16-T-1 skips an empty phone number, SCRUM-16-T-1 skips a null phone number, and SCRUM-16-T-1 skips an undefined phone number — asserts status "skipped", flag null, and the missing-phone message.

- Criterion 8: SCRUM-16-T-1 skips a phone number with an invalid length — evaluates a phone number that cannot be normalized to exactly 10 digits and asserts status "skipped", flag null, and the invalid-format message.

- Criterion 9: SCRUM-16-T-1 rejects non-string phone input, SCRUM-16-T-1 rejects boolean phone input, and SCRUM-16-T-1 rejects object phone input — evaluates numeric, boolean, and object inputs and asserts { success: false, error: "Invalid phone input parameter" } without throwing exceptions.

- Criterion 10: SCRUM-16-T-1 schema accepts strings, empty strings, and nullish values and SCRUM-16-T-1 converts the listing state to uppercase — verifies the Zod input schema and confirms lowercase target states are normalized to uppercase before the MongoDB query.

Error handling: SCRUM-16-T-1 returns failure when the state mapping is missing and SCRUM-16-T-1 handles database lookup failures — mocks a missing state mapping and a rejected database query, asserting the expected failure envelopes without unhandled exceptions.
