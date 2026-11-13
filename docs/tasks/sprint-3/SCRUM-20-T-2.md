---
id: SCRUM-20-T-2
story: SCRUM-20
sprint: 3
assignee: Adan Magana
estimate_hours: 4
---

# Implement land-use classification

## Description

Serves SCRUM-20 (verify listing address exists and is designated for residential living). This task implements the backend service in server/src/services/landUse.service.ts to evaluate Santa Cruz County Assessor use codes (USECDDESC, ASRUSECD) against lawful residential standards. The service classifies properties into residential living spaces, non-residential commercial/municipal facilities, and vacant/unbuilt land. Out of scope: address resolution (-T-1) and API route integration.

## Specs

- The service exposes an evaluation function and Zod input schema (LandUseInputSchema): { useCode: string | null | undefined, useDescription: string | null | undefined }.

- When useCode or useDescription is missing, null, or undefined, the service returns { success: true, data: { status: "skipped", flag: null, message: "Land use code not specified; check skipped", category: null } }.

- When use code indicates residential dwellings (e.g. 020 Single Residence, 021 Condo, 030 Duplex, 041 Multi-Units), the service returns { success: true, data: { status: "compliant", flag: null, message: "Complies with lawful residential land use", category: "residential" } }.

- When use code indicates commercial, office, or municipal facilities (e.g. 121 Stores, 171 Offices, 921 County Building), the service returns { success: true, data: { status: "violation", flag: "NON_RESIDENTIAL_LAND_USE", message: "Property is designated for commercial or municipal use, not residential living", category: "commercial" } }.

- When use code indicates vacant land or unbuilt parcels (e.g. 010 Vacant Lot, 830 Token Value, 090 Common Area), the service returns { success: true, data: { status: "warning", flag: "VACANT_OR_UNBUILT_PARCEL", message: "Property is classified as vacant land or unbuilt parcel", category: "vacant" } }.

- Invalid data types are rejected cleanly with { success: false, error: "Invalid land use input values" } without throwing unhandled exceptions.

## Requirements

- Service must be implemented in server/src/services/landUse.service.ts.

- Input validation and derived types must use Zod (z.infer<typeof ...>) colocated in the service file.

- All unit tests must be located in server/tests/SCRUM-XX-T-2_landUse.test.ts with zero external network dependencies.

- No database migrations, routes, or frontend modifications in this task.

## Acceptance criteria

1. A residential use code (single residence, condo, duplex, or multi-family units) returns status: "compliant" with zero red flags and category "residential".

2. A commercial, retail, office, or municipal use code returns status: "violation" and triggers flag NON_RESIDENTIAL_LAND_USE.

3. A vacant lot, unbuilt parcel, or common area use code returns status: "warning" and triggers flag VACANT_OR_UNBUILT_PARCEL.

4. Missing, null, or undefined use code or description inputs return status: "skipped" without throwing errors or generating false positive flags.

5. Non-string data types are rejected with { success: false } and a descriptive error message without crashing the server process.

## Tests
