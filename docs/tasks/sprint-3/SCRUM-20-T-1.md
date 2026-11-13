---
id: SCRUM-20-T-1
story: SCRUM-20
sprint: 3
assignee: Adan Magana
estimate_hours: 4
---

# Implement GIS address query service

## Description
Serves SCRUM-20 (verify listing address exists and is designated for residential living). This task implements the backend service in server/src/services/gisQuery.service.ts to query the Santa Cruz County Assessor parcel MapServer (data/MapServer/2). The service normalizes incoming listing addresses, strips unit designators, and executes ArcGIS REST queries with an explicit timeout, distinguishing between verified parcels, unverified addresses, and service outages. Out of scope: land use code classification (-T-2) and API route integration.

## Specs
- The service exposes an evaluation function and Zod input schema (GisQueryInputSchema): { address: string | null | undefined }.

- When address is missing, null, or undefined, the service returns { success: true, data: { status: "skipped", flag: null, message: "Address not specified; check skipped", parcel: null } }.

- When address resolves to a matching Santa Cruz County parcel, the service returns { success: true, data: { status: "compliant", flag: null, message: "Address verified in county parcel records", parcel: { apn: string, siteAddress: string, city: string, zip: string, useCode: string, useDescription: string } } }.

- When address yields 0 matching features or lies outside Santa Cruz County, the service returns { success: true, data: { status: "warning", flag: "UNVERIFIED_ADDRESS", message: "Address could not be verified in Santa Cruz County records", parcel: null } }.

- When external requests exceed 5000ms or return HTTP 4xx/5xx errors, the service returns { success: true, data: { status: "skipped", flag: "GIS_SERVICE_UNAVAILABLE", message: "County GIS service timed out or unavailable; check skipped", parcel: null } }.

- Negative numbers, non-string types, or invalid data types are rejected cleanly with { success: false, error: "Invalid address input value" } without throwing unhandled exceptions.

## Requirements
- Service must be implemented in server/src/services/gisQuery.service.ts.

- Input validation and derived types must use Zod (z.infer<typeof ...>) colocated in the service file.

- Outgoing external requests must specify an explicit 5000ms timeout.

- All unit tests must be located in server/tests/SCRUM-20-T-1_gisQuery.test.ts with zero external network dependencies (mocked JSON fixtures).

- No database migrations, routes, or frontend modifications in this task.

## Acceptance criteria
1. A valid Santa Cruz address resolves to a county parcel, returns status: "compliant" with zero red flags, and extracts parcel APN and use code description.

2. An address containing an apartment or unit number (e.g. "530 High St Apt 4B") normalizes cleanly and resolves to the base parcel.

3. A non-existent address or an address outside Santa Cruz County returns status: "warning" and triggers flag UNVERIFIED_ADDRESS.

4. Missing, null, or undefined address inputs return status: "skipped" without throwing errors or generating false positive flags.

5. An external request timeout (5000ms) or HTTP error returns status: "skipped" and flag GIS_SERVICE_UNAVAILABLE without crashing the server process.

6. Non-string data types are rejected with { success: false } and a descriptive error message without crashing the server process.

## Tests

File: `server/tests/SCRUM-20-T-1_gisQuery.test.ts`

Setup for all: Offline unit tests directly invoking the exported GIS evaluation service with mocked ArcGIS responses and zero external network dependencies.

- Criterion 1: SCRUM-20-T-1 returns compliant when a parcel is found — mocks a successful ArcGIS parcel response, asserts status "compliant", flag null, message "Address verified in county parcel records", and verifies parcel APN, use code, use description, and address fields are extracted.

- Criterion 2: SCRUM-20-T-1 removes apartment numbers, SCRUM-20-T-1 removes hash unit identifiers, and SCRUM-20-T-1 normalizes whitespace and capitalization — evaluates apartment-designated, hash-designated, and irregularly formatted addresses, asserting normalization produces a parcel-searchable base address.

- Criterion 3: SCRUM-20-T-1 returns warning when no parcel is found — mocks an ArcGIS response containing zero matching features, asserts status "warning", flag "UNVERIFIED_ADDRESS", and parcel null.

- Criterion 4: SCRUM-20-T-1 returns skipped when input is undefined, SCRUM-20-T-1 returns skipped when address is null, SCRUM-20-T-1 returns skipped when address is empty, and SCRUM-20-T-1 returns skipped when address is whitespace only — evaluates missing and blank address inputs, asserts status "skipped", flag null, and message "Address not specified; check skipped".

- Criterion 5: SCRUM-20-T-1 returns skipped when GIS service returns an HTTP error and SCRUM-20-T-1 returns skipped when GIS service throws an error — mocks HTTP failures and network/timeout failures, asserts status "skipped", flag "GIS_SERVICE_UNAVAILABLE", and parcel null.

- Criterion 6: SCRUM-20-T-1 rejects invalid address input values and SCRUM-20-T-1 schema rejects non-string address values — evaluates invalid address types such as numeric values, asserts { success: false, error: "Invalid address input value" } without throwing unhandled exceptions.