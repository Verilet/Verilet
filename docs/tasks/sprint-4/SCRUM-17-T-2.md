---
Task ID: SCRUM-17-T-2
Story: SCRUM-17
Sprint: 4
Assignee: Lars Voigt-Bui
Estimate: 4 hours
---

# Agency Verification Evaluator & Corporate Indicator Heuristics

# Description

Serves SCRUM-17 (verify corporate rental agencies against California registry records). This task implements the business evaluation logic in server/src/services/agencyVerification.service.ts. It validates input parameters with Zod, pre-filters landlord names to distinguish corporate entities from private individuals, calls the registry client from SCRUM-17-T-1, maps registry statuses into standardized verification envelopes, and provides educational advice regarding DBAs and DRE broker licenses. Out of scope: HTTP fetch and caching implementation (SCRUM-17-T-1), routes, and UI.

## Specs

- Input schema colocated in server/src/services/agencyVerification.service.ts:

- AgencyVerificationInputSchema: z.string().trim().nullish() (allows string, null, or undefined; rejects non-string types like numbers/booleans).

- Derived TypeScript type: AgencyVerificationInput = z.infer<typeof AgencyVerificationInputSchema>.

- verifyAgencyStanding(landlordName, clientOverride?):

- Validates landlordName with AgencyVerificationInputSchema.safeParse(). If invalid type (e.g. number/boolean), returns { success: false, error: 'Invalid landlord name input parameter' }.

- If landlordName is empty, null, undefined, or does NOT match corporate indicators (LLC, Inc, Corp, Properties, Property Management, Realty, Real Estate, Rentals, Group, Holdings, Apartments), returns { success: true, data: { status: 'skipped', flag: null, message: 'Private individual landlord or unlisted; check skipped' } }.

- Invokes fetchCaliforniaCompany(landlordName) (or clientOverride).

- If the client returns an error (RATE_LIMITED, TIMEOUT, NETWORK_ERROR, or API_KEY_MISSING): returns { success: true, data: { status: 'skipped', flag: null, message: 'Registry verification currently unavailable; check skipped' } }.

- If the client returns data: null (zero records found): returns { success: true, data: { status: 'warning', flag: 'UNREGISTERED_AGENCY', message: 'Corporate entity could not be verified in California registry; may operate under a parent DBA or individual DRE broker license', entityDetails: null } }.

- If the company's current_status matches suspended, forfeited, or dissolved (e.g. "FTB Suspended", "SOS Suspended"): returns { success: true, data: { status: 'violation', flag: 'SUSPENDED_BUSINESS_ENTITY', message: 'Corporate entity is suspended or forfeited in California; legally disqualified from conducting business', entityDetails: { legalName: company.name, entityNumber: company.company_number, status: company.current_status } } }.

- If the company's current_status is Active: returns { success: true, data: { status: 'compliant', flag: null, message: 'Active registered corporate entity in California', entityDetails: { legalName: company.name, entityNumber: company.company_number, status: company.current_status } } }.

## Requirements

- Input validation must use colocated Zod schema (AgencyVerificationInputSchema); derived types use z.infer.

- Evaluator depends on the client via import or optional dependency injection for easy testability.

- No direct fetch calls in this service.

- Return payload conforms strictly to the standardized envelope ({ success: true, data: { status, flag, message, entityDetails } }).

- Unit tests in server/tests/SCRUM-17-T-2_agencyVerification.test.ts run offline using mocked client outputs.

## Acceptance criteria

- A private individual name (e.g. "Jane Doe") returns status: "skipped" with flag: null without calling the registry client.

- An agency name that returns null from the client returns status: "warning" and flag: "UNREGISTERED_AGENCY".

- An agency with status "FTB Suspended", "SOS Suspended", or "Dissolved" returns status: "violation" and flag: "SUSPENDED_BUSINESS_ENTITY".

- An active registered agency returns status: "compliant" with populated entityDetails.

- Client network errors, timeouts, rate limits, or missing API keys return status: "skipped" with an explanatory message.

- Empty or null landlord names return status: "skipped".

- Malformed non-string inputs (e.g. numbers or booleans) return { success: false } without crashing the server process.

- Tests include at least 5 synthetic scenarios (active, suspended, not found, rate limit, private landlord) with zero network calls.

## Tests

- Criterion 1: SCRUM-17-T-2 returns { success: true, data: { status: 'skipped', flag: null, message: 'Private individual landlord or unlisted; check skipped' } } without calling the registry client when given a private individual name such as "Jane Doe" or "John Smith". It asserts the mocked client was called 0 times. It evaluates names that contain no corporate indicator and asserts the same result. It evaluates a name where an indicator only appears inside another word (e.g., "Grouper Jones") and asserts skipped (whole-word matching).

- Criterion 2: SCRUM-17-T-2 returns status: 'skipped' with flag: null when given empty or missing landlord names. It evaluates "", " ", null and undefined, asserts skipped each time, and asserts the mocked client was called 0 times.

- Criterion 3: SCRUM-17-T-2 returns { success: false, error: 'Invalid landlord name input parameter' } when given a non-string input. It evaluates 69, true, false, {} and [], asserts each returns that exact envelope, asserts none throw, and asserts the mocked client was called 0 times.

- Criterion 4: SCRUM-17-T-2 returns status: 'warning' and flag: 'UNREGISTERED_AGENCY' when the mocked client returns { success: true, data: null } for a corporate-sounding name such as "Pacific Coast Rentals LLC". It asserts entityDetails is null and the message mentions that the entity could not be verified and may operate under a parent DBA or individual DRE broker license. It asserts the client was called once with the trimmed name.

- Criterion 5: SCRUM-17-T-2 returns status: 'violation' and flag: 'SUSPENDED_BUSINESS_ENTITY' when the mocked client returns a company whose current_status is "FTB Suspended", "SOS Suspended" or "Dissolved". It evaluates each, asserts one violation each, and asserts entityDetails equals { legalName: company.name, entityNumber: company.company_number, status: company.current_status }. It evaluates "Forfeited" and lowercase "suspended" and asserts the same violation (case-insensitive matching).

- Criterion 6: SCRUM-17-T-2 returns status: 'compliant' with flag: null when the mocked client returns a company whose current_status is "Active". It asserts the message is "Active registered corporate entity in California" and that entityDetails carries the verified legal name, entity number and status from the mocked record. It evaluates "active" in lowercase and asserts compliant.

- Criterion 7: SCRUM-17-T-2 returns status: 'skipped' with flag: null and the message "Registry verification currently unavailable; check skipped" when the mocked client returns an error. It evaluates { success: false, data: null, error: 'RATE_LIMITED' }, 'TIMEOUT', and { success: true, data: null, error: 'API_KEY_MISSING' }, and asserts skipped each time. It asserts the API_KEY_MISSING case is not reported as UNREGISTERED_AGENCY, even though its data is null. It evaluates a client that throws and asserts the service still returns skipped without crashing.

- Criterion 8: SCRUM-17-T-2 always returns the standardized envelope and makes no live network calls. It asserts every successful result has success: true and data with status, flag and message, and asserts status is one of compliant, warning, violation or skipped. It asserts the suite injects the client through clientOverride (no fetch mocking needed) and runs offline.
