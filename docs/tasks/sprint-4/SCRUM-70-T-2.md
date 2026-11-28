---
id: SCRUM-70-T-2
story: SCRUM-70
sprint: 4
assignee: Aubrey Hayes
estimate_hours: 4
---

# Deterministic listing risk scoring engine and diagnostic check normalization

## Description

Serves SCRUM-70 (calculate composite risk score and format diagnostic check details). This task implements the scoring engine in `server/src/services/scoringEngine.service.ts`. It takes the aggregated worker outputs (`rawChecks`) from `SCRUM-70-T-1`, normalizes each raw worker result into a standardized `CheckResult`, applies a deterministic point-weight rubric (capped between 0 and 100), and handles the minimum data threshold edge case (< 3 evaluated checks) by returning `score: null` with rating `INSUFFICIENT_DATA`. Out of scope: route registration (`SCRUM-70-T-1`) and frontend UI integration (`SCRUM-70-T-3`).

## Specs

- **Function Signature (`server/src/services/scoringEngine.service.ts`):**
  - `calculateListingScore(rawChecks: RawChecks): ScoreResult`
- **Output Types:**
  - `CheckStatus`: `'FLAG' | 'UNKNOWN' | 'OK' | 'SKIPPED'`
  - `RiskRating`: `'LOW' | 'MEDIUM' | 'HIGH' | 'INSUFFICIENT_DATA'`
  - `CheckResult`:
    - `id`: `string` (`'price'`, `'securityDeposit'`, `'applicationFee'`, `'untraceablePayment'`, `'gisQuery'`, `'landUse'`, `'contactPhone'`, `'agencyStanding'`, `'listingSearch'`).
    - `title`: `string` (Human-readable check label).
    - `status`: `CheckStatus`.
    - `scoreImpact`: `number` (Non-negative point addition contributed by this check).
    - `detail`: `string` (Human-readable diagnostic description).
    - `evidence`: `string | null` (Specific string, quote, or value triggering the finding).
  - `ScoreResult`:
    - `score`: `number | null` (Composite risk score from 0 to 100, or `null` if insufficient data).
    - `rating`: `RiskRating` (`LOW`, `MEDIUM`, `HIGH`, or `INSUFFICIENT_DATA`).
    - `summary`: `string` (Actionable summary explaining the overall assessment).
    - `checks`: `CheckResult[]` (Array of normalized diagnostic results).

- **Deterministic Point Weight Rubric Constants (Top-of-file constants):**
  - `POINTS_UNTRACEABLE_PAYMENT = 40`: Untraceable payment methods (wire transfer, cryptocurrency, gift card).
  - `POINTS_ADVANCE_FEE = 35`: Advance-fee P2P payment requests prior to tour.
  - `POINTS_RENT_UNDER_50 = 35`: Monthly rent < 50% of regional baseline average.
  - `POINTS_RENT_UNDER_75 = 15`: Monthly rent between 50% and 75% of regional baseline average.
  - `POINTS_DUPLICATE_MISMATCH = 35`: Cross-platform duplicate listing mismatch found.
  - `POINTS_SUSPENDED_ENTITY = 30`: Landlord / management entity suspended in business registry.
  - `POINTS_UNREGISTERED_ENTITY = 10`: Landlord / management entity not found or unregistered.
  - `POINTS_UNVERIFIED_ADDRESS = 25`: Address not verified in county GIS assessor parcel records.
  - `POINTS_LAND_USE_MISMATCH = 25`: Property parcel zoned for non-residential or vacant use.
  - `POINTS_OBFUSCATED_CONTACT = 25`: Obfuscated contact phone/email detected in description.
  - `POINTS_NON_LOCAL_PHONE = 15`: Contact phone has non-local area code or international prefix.
  - `POINTS_DEPOSIT_OVER_2X = 25`: Security deposit exceeds 2x monthly rent statutory cap.
  - `POINTS_DEPOSIT_OVER_1X = 10`: Security deposit exceeds standard 1x monthly rent cap.
  - `POINTS_EXCESSIVE_FEE = 15`: Screening application fee exceeds California statutory cap ($65).
  - Compliant (`OK`), Skipped (`SKIPPED`), and Unknown (`UNKNOWN`) checks add 0 points.

- **Threshold & Rating Rules:**
  - `MIN_EVALUATED_CHECKS_THRESHOLD = 3`: At least 3 checks must have evaluable data (`status === 'OK' || status === 'FLAG'`).
  - If evaluated count < 3, return `score: null`, `rating: 'INSUFFICIENT_DATA'`, and summary `'Could not evaluate listing due to insufficient data. Please add details to calculate risk.'`.
  - When evaluated count >= 3, compute `totalPoints = sum(checks.map(c => c.scoreImpact))`.
  - Final score is capped: `score = Math.min(100, Math.max(0, totalPoints))`.
  - Rating bands:
    - `0` – `39`: `LOW`
    - `40` – `69`: `MEDIUM`
    - `70` – `100`: `HIGH`

## Requirements

- Pure function: zero network calls, zero database connections, and zero filesystem operations.
- 100% deterministic logic with all point weight constants declared in `CONSTANT_CASE` at the top of `server/src/services/scoringEngine.service.ts`.
- Worker failures (`WORKER_FAILED`) and missing baselines normalize safely to `UNKNOWN` or `SKIPPED` without throwing unhandled exceptions.
- Unit tests reside in `server/tests/SCRUM-70-T-2_scoringEngine.test.ts`.
- Unit test assertions follow `docs/style-guide.md §3.2`, prefixed with `[Criterion N]`.
- Formatting and linting (`npm run format:check` and `npm --prefix server run lint`) must pass cleanly.

## Acceptance criteria

1. A listing with multiple high-severity violations (e.g. untraceable cryptocurrency payment and rent < 50% baseline) accumulates points correctly and caps at a maximum score of 100 with rating `HIGH`.
2. A listing with compliant checks and no violations receives a composite score between 0 and 39 with rating `LOW`.
3. A listing with moderate risk violations (e.g. out-of-state area code and non-compliant security deposit between 1x and 2x rent) calculates a composite score between 40 and 69 with rating `MEDIUM`.
4. Checks with status `SKIPPED`, `OK`, or `UNKNOWN` (including worker failure fallbacks) strictly contribute 0 points to the composite score.
5. When fewer than 3 checks have sufficient evaluable data (including the all-skipped edge case), the engine returns `score: null`, rating `INSUFFICIENT_DATA`, and a summary explaining that at least 3 checks are required.
6. When 3 or more checks are evaluated without violations, a numeric score of 0 and rating `LOW` are returned rather than `INSUFFICIENT_DATA`.
7. Each check in the returned `checks` array includes valid `id`, `title`, `status` (`FLAG` | `UNKNOWN` | `OK` | `SKIPPED`), `scoreImpact`, `detail`, and optional `evidence`.

## Tests

File: `server/tests/SCRUM-70-T-2_scoringEngine.test.ts`
Setup for all: Pure offline unit tests calling `calculateListingScore(rawChecks)` directly with synthetic worker payload fixtures. Zero network or database mocks required.

- Criterion 1: `SCRUM-70-T-2 accumulates critical violations and caps score at 100 with rating HIGH` — passes payload with crypto payment (+40), advance fee (+35), and rent under 50% baseline (+35); asserts `score === 100` and `rating === 'HIGH'`.
- Criterion 2: `SCRUM-70-T-2 evaluates compliant checks to low risk score between 0 and 39 with rating LOW` — passes fully compliant worker results; asserts `score === 0`, `rating === 'LOW'`, and all checks report `status: 'OK'`.
- Criterion 3: `SCRUM-70-T-2 evaluates moderate violations to risk score between 40 and 69 with rating MEDIUM` — passes payload with out-of-state area code (+15) and security deposit between 1x and 2x rent (+10) and excessive fee (+15); asserts `score === 40` and `rating === 'MEDIUM'`.
- Criterion 4: `SCRUM-70-T-2 strictly adds 0 points for SKIPPED, OK, and UNKNOWN checks` — passes payloads containing skipped checks, worker failures, and missing baselines; asserts their `scoreImpact` is strictly 0 and total points are unaffected.
- Criterion 5: `SCRUM-70-T-2 returns null score and INSUFFICIENT_DATA when fewer than 3 checks are evaluated` — passes payloads with 0, 1, and 2 evaluable checks; asserts `score === null`, `rating === 'INSUFFICIENT_DATA'`, and descriptive summary.
- Criterion 6: `SCRUM-70-T-2 calculates valid LOW rating when exactly 3 compliant checks are evaluated` — passes payload with exactly 3 compliant checks and 6 skipped checks; asserts `score === 0` and `rating === 'LOW'`.
- Criterion 7: `SCRUM-70-T-2 normalizes raw worker outputs into complete CheckResult objects` — inspects all 9 returned checks; asserts each contains valid `id`, `title`, `status`, `scoreImpact`, `detail`, and populated or null `evidence`.
