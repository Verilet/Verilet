---
id: SCRUM-21-T-2
story: SCRUM-21
sprint: 3
assignee: Aubrey Hayes
estimate_hours: 4
---

# California Civil Code § 1950.6 application screening fee statutory evaluation service

## Description

Serves SCRUM-21 (validate listing financials against California tenancy laws). This task implements the backend service in `server/src/services/applicationFee.service.ts` to evaluate requested application screening fees against California Civil Code § 1950.6 statutory limits. The service evaluates requested fees against a baseline standard limit ($65) while supporting an optional statutory cap override to future-proof the engine against annual state Consumer Price Index (CPI) increases. Out of scope: security deposit evaluation (-T-1) and API route integration.

## Specs

- The service exposes an evaluation function `evaluateApplicationFee(input?, options?)`, default statutory constant `DEFAULT_MAX_APPLICATION_FEE = 65`, and Zod input schema (`ApplicationFeeInputSchema`): `{ applicationFee: number | null | undefined }`.
- The evaluation function accepts an optional options object `ApplicationFeeOptions`: `{ maxFee?: number }`, defaulting to `DEFAULT_MAX_APPLICATION_FEE`.
- When `applicationFee` is missing, null, or undefined, the service returns `{ success: true, data: { status: "skipped", flag: null, message: "Application fee not specified; check skipped", statutoryCitation: null } }`.
- When `applicationFee` is less than or equal to the effective statutory limit (including $0 / free applications), the service returns `{ success: true, data: { status: "compliant", flag: null, message: "Complies with California statutory screening fee limits", statutoryCitation: "Cal. Civ. Code § 1950.6" } }`.
- When `applicationFee` exceeds the effective statutory limit, the service returns `{ success: true, data: { status: "violation", flag: "EXCESSIVE_APPLICATION_FEE", message: `Application screening fee exceeds California statutory limit of $${effectiveLimit}`, statutoryCitation: "Cal. Civ. Code § 1950.6(b)" } }`.
- Negative numbers, invalid data types, or invalid option limits are rejected cleanly with `{ success: false, error: "Invalid application fee value" }` without throwing unhandled exceptions.

## Requirements

- Service must be implemented in `server/src/services/applicationFee.service.ts`.
- Input validation and derived types must use Zod (`z.infer<typeof ...>`) colocated in the service file.
- All unit tests must be located in `server/tests/SCRUM-21-T-2_applicationFee.test.ts` with zero external network dependencies.
- Future flexibility: The service must support an optional `options` parameter allowing callers to specify `maxFee` to accommodate future statutory CPI adjustments without modifying core business logic.
- No database migrations, routes, or frontend modifications in this task.

## Acceptance criteria

1. An application fee less than or equal to the default $65 cap (including $0) returns status: "compliant" with zero red flags and confirms statutory compliance.
2. An application fee strictly exceeding the default $65 cap returns status: "violation" and triggers flag EXCESSIVE_APPLICATION_FEE.
3. Missing, null, or undefined applicationFee inputs return status: "skipped" without throwing errors or generating false positive flags.
4. An application fee of exact boundary value $65 passes as compliant.
5. A custom future statutory cap passed via options (e.g. $70) is respected, so a fee above $65 but within the custom cap returns status: "compliant", while a fee above the custom cap returns status: "violation".
6. Negative numeric values or non-numeric types are rejected with { success: false } and a descriptive error message without crashing the server process.

## Tests

File: `server/tests/SCRUM-21-T-2_applicationFee.test.ts`
Setup for all: Offline unit tests directly invoking the exported evaluation function with controlled financial inputs.

- Criterion 1: `SCRUM-21-T-2 returns compliant when application fee is <= $65` — evaluates application fees under $65 (e.g. $0 or $35), asserts status "compliant", flag null, message confirms compliance, and statutoryCitation "Cal. Civ. Code § 1950.6".
- Criterion 2: `SCRUM-21-T-2 returns violation and EXCESSIVE_APPLICATION_FEE when application fee > $65` — evaluates fees exceeding $65 (e.g. $70 or $100), asserts status "violation", flag "EXCESSIVE_APPLICATION_FEE", message explains violation, and statutoryCitation "Cal. Civ. Code § 1950.6(b)".
- Criterion 3: `SCRUM-21-T-2 returns skipped when application fee is missing, null, or undefined` — evaluates inputs with null, undefined, or missing values for applicationFee, asserts status "skipped", flag null, and message "Application fee not specified; check skipped".
- Criterion 4: `SCRUM-21-T-2 returns compliant for exact boundary value of $65` — evaluates boundary fee of exactly $65, asserts status "compliant", flag null, message confirms compliance, and statutoryCitation "Cal. Civ. Code § 1950.6".
- Criterion 5: `SCRUM-21-T-2 respects custom future statutory cap passed via options` — evaluates a fee of $68 with `{ maxFee: 70 }` asserting status "compliant", and $75 with `{ maxFee: 70 }` asserting status "violation" and flag "EXCESSIVE_APPLICATION_FEE".
- Criterion 6: `SCRUM-21-T-2 rejects negative values and invalid non-numeric data types cleanly` — evaluates negative values (e.g. -$20) and non-numeric types (e.g. strings or booleans), asserts `{ success: false, error: "Invalid application fee value" }` without throwing unhandled exceptions.
