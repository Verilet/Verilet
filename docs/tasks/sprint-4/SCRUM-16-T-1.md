---
id: SCRUM-16-T-1
story: SCRUM-16
sprint: 4
assignee: Adan Magana
estimate_hours: 6
---

# Classify phone numbers by geographic area code

## Description

Serves SCRUM-16 (detect contact anomalies and out-of-state listers). This task implements the MongoDB data layer and phone area code evaluation service used to identify potentially suspicious rental listing contact information. The service normalizes submitted US phone numbers and compares their area codes against state-specific mappings stored in MongoDB. It identifies local and regional California numbers, commercial toll-free numbers, and numbers originating outside the listing's target state. Missing or unusable phone numbers are skipped.

## Specs

- Create AreaCodeModel in server/src/models/areaCode.model.ts with:
  state: required uppercase two-letter US state abbreviation with a unique index.
  codes: required array of three-digit area code strings.

- Create server/src/scripts/seedAreaCodes.ts to populate the areaCodes MongoDB collection with California area codes, including 831 and regional Bay Area codes, and mappings for common comparison states.

- Define PhoneFlagInputSchema in server/src/services/phoneFlags.service.ts using z.string().trim().nullish().

- Export the derived PhoneFlagInput type using z.infer<typeof PhoneFlagInputSchema>.

- Implement evaluatePhoneAreaCode(phone, targetState = 'CA').

- Validate phone inputs using PhoneFlagInputSchema.safeParse().

- Normalize phone numbers by removing non-digit characters and stripping a leading US country code (1) from an 11-digit number.

- Phone numbers that cannot be normalized to exactly 10 digits return a skipped result.

- Check commercial toll-free prefixes (800, 888, 877, 866, 855, 844, 833) before querying MongoDB.

- Query AreaCodeModel.findOne({ state: targetState.toUpperCase() }) and use the state's area code list to classify the number.

- Return the following classifications:
  compliant: The number has a local/regional area code or commercial toll-free prefix.
  warning: The number has an area code not listed for the target state, with flag NON_LOCAL_AREA_CODE.
  skipped: The phone number is missing or cannot be normalized.

- Return standardized response envelopes:

- Successful evaluation: { success: true, data: { status, flag, message, areaCode } }.

- Invalid input: { success: false, error: string }.

- If the target state's area code mapping is missing or the database query fails, return a failure envelope instead of throwing an unhandled exception.

- If targetState is omitted, the service evaluates the phone number against California (CA).

- Missing phone: `Phone number not specified; check skipped`

- Invalid phone format: `Phone number format invalid; check skipped`

- Toll-free: `Commercial toll-free phone number`

- Local/regional: `Phone area code matches listing region`

## Requirements

- Use Mongoose for the AreaCode model and MongoDB queries.

- Use Zod for phone input validation.

- Follow existing repository conventions for Mongoose models and service response envelopes.

- Use Vitest for unit tests.

- Mock Mongoose queries using vi.spyOn(AreaCodeModel, 'findOne') or an equivalent mock. Tests must run without a live MongoDB connection.

- Do not introduce unnecessary runtime dependencies.

- Preserve existing functionality and ensure existing tests continue passing.

- Every acceptance criterion must have at least one committed test.

## Acceptance criteria

1. The AreaCodeModel enforces a required, unique, uppercase two-letter state code and an array of valid three-digit area codes.

2. Running the area code seed script populates the MongoDB areaCodes collection with California area codes, including 831 and regional Bay Area codes, and mappings for common comparison states.

3. A California phone number with a local or regional area code, such as 831, 408, or 650, returns status: "compliant" and flag: null.

4. A commercial toll-free phone number beginning with 800, 888, 877, 866, 855, 844, or 833 returns status: "compliant" and flag: null without querying MongoDB.

5. A phone number with an out-of-state area code, such as 305, 212, 512, or 206, returns status: "warning" and flag: "NON_LOCAL_AREA_CODE" when evaluated against California.

6. Phone number normalization correctly handles formatted inputs such as (831) 555-0199, +1 831 555 0199, and 831.555.0199.

7. Missing phone inputs (undefined, null, or an empty string) return status: "skipped" and flag: null. Inputs that cannot be normalized to exactly 10 digits also return status: "skipped" and flag: null.

8. Non-string inputs, including numbers, booleans, and objects, return { success: false, error: "Invalid phone input parameter" } without crashing the process.

9. Missing state mappings and MongoDB query failures return a failure envelope without producing unhandled exceptions.

## Tests
