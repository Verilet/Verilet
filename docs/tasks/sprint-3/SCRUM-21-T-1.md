---
id: SCRUM-21-T-1
story: SCRUM-21
sprint: 3
assignee: Aubrey Hayes
estimate_hours: 4
---

# California AB 12 security deposit statutory evaluation service

## Description

Serves SCRUM-21 (validate listing financials against California tenancy laws). This task implements the backend service in `server/src/services/securityDeposit.service.ts` to evaluate requested security deposits against monthly rent. The service enforces California AB 12 (Civil Code § 1950.5), distinguishing between the standard 1-month rent cap, the 2-month qualified small landlord exemption, and illegal deposits exceeding 2 months' rent. Out of scope: application screening fees (-T-2) and API route integration.

## Specs

- The service exposes an evaluation function and Zod input schema (`SecurityDepositInputSchema`): `{ rent: number | null | undefined, deposit: number | null | undefined }`.
- When `deposit` or `rent` is missing, null, or undefined, the service returns `{ success: true, data: { status: "skipped", flag: null, message: "Deposit or rent not specified; check skipped", statutoryCitation: null } }`.
- When `deposit` is less than or equal to `rent` (`deposit <= 1x rent`), the service returns `{ success: true, data: { status: "compliant", flag: null, message: "Complies with California standard statutory limit (AB 12)", statutoryCitation: "Cal. Civ. Code § 1950.5(c)" } }`.
- When `deposit` is greater than 1x rent but less than or equal to 2x rent (`1x < deposit <= 2x`), the service returns `{ success: true, data: { status: "warning", flag: "EXCEEDS_STANDARD_DEPOSIT_CAP", message: "Deposit exceeds standard 1-month cap; only lawful if landlord qualifies for AB 12 small landlord exemption", statutoryCitation: "Cal. Civ. Code § 1950.5(c)(4)" } }`.
- When `deposit` exceeds 2x rent (`deposit > 2x`), the service returns `{ success: true, data: { status: "violation", flag: "ILLEGAL_SECURITY_DEPOSIT", message: "Deposit exceeds absolute California statutory ceiling of 2 months' rent", statutoryCitation: "Cal. Civ. Code § 1950.5(c)" } }`.
- Negative numbers or invalid data types are rejected cleanly with `{ success: false, error: "Invalid financial input values" }` without throwing unhandled exceptions.

## Requirements

- Service must be implemented in `server/src/services/securityDeposit.service.ts`.
- Input validation and derived types must use Zod (`z.infer<typeof ...>`) colocated in the service file.
- All unit tests must be located in `server/tests/SCRUM-21-T-1_securityDeposit.test.ts` with zero external network dependencies.
- No database migrations, routes, or frontend modifications in this task.

## Acceptance criteria

1. A security deposit less than or equal to 1 month's rent returns status: "compliant" with zero red flags and confirms AB 12 compliance.
2. A security deposit greater than 1x rent and less than or equal to 2x rent returns status: "warning" and triggers flag EXCEEDS_STANDARD_DEPOSIT_CAP.
3. A security deposit exceeding 2x rent returns status: "violation" and triggers flag ILLEGAL_SECURITY_DEPOSIT.
4. Missing, null, or undefined deposit or rent inputs return status: "skipped" without throwing errors or generating false positive flags.
5. Negative numeric values or non-numeric types are rejected with { success: false } and a descriptive error message without crashing the server process.

## Tests

File: `server/tests/SCRUM-21-T-1_securityDeposit.test.ts`
Setup for all: Offline unit tests directly invoking the exported evaluation function with controlled financial inputs.

- Criterion 1: `SCRUM-21-T-1 returns compliant when deposit is <= 1x rent` — evaluates deposit <= rent (e.g. deposit equal to rent or deposit less than rent), asserts status "compliant", flag null, message confirms AB 12 compliance, and statutoryCitation "Cal. Civ. Code § 1950.5(c)".
- Criterion 2: `SCRUM-21-T-1 returns warning and EXCEEDS_STANDARD_DEPOSIT_CAP when 1x < deposit <= 2x rent` — evaluates deposit between 1x and 2x rent (e.g. 1.5x rent, 2x rent), asserts status "warning", flag "EXCEEDS_STANDARD_DEPOSIT_CAP", and statutoryCitation "Cal. Civ. Code § 1950.5(c)(4)".
- Criterion 3: `SCRUM-21-T-1 returns violation and ILLEGAL_SECURITY_DEPOSIT when deposit > 2x rent` — evaluates deposit exceeding 2x rent (e.g. 2.5x rent), asserts status "violation", flag "ILLEGAL_SECURITY_DEPOSIT", and statutoryCitation "Cal. Civ. Code § 1950.5(c)".
- Criterion 4: `SCRUM-21-T-1 returns skipped when rent or deposit is missing, null, or undefined` — evaluates inputs with null, undefined, or missing values for deposit and rent, asserts status "skipped", flag null, and message "Deposit or rent not specified; check skipped".
- Criterion 5: `SCRUM-21-T-1 rejects negative values and invalid non-numeric data types cleanly` — evaluates negative numbers (e.g. rent -1000 or deposit -500) and invalid types (e.g. strings or booleans), asserts `{ success: false, error: "Invalid financial input values" }` without throwing unhandled exceptions.
