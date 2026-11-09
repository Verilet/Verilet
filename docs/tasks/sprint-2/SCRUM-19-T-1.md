---
id: SCRUM-19-T-1
story: SCRUM-19
sprint: 2
assignee: Chester
estimate_hours: 6
---

# Price outlier checker for Santa Cruz rentals

## Description

Serves SCRUM-19. Fraudulent listers post rentals far below market rate to lure students.
This checker compares a listing's rent with the typical rent for its space type and
location, and flags rent under 50% of that baseline as a critical price outlier.

## Specs

- Input (Zod-validated): `rent` (positive number), `spaceType`
  (`shared_room` | `single_room` | `1br` | `2br`), optional `zip` (5 digits), optional `city`.
- Baselines come from the `rent_baselines` collection in MongoDB Atlas.
- Lookup order: match by ZIP and space type; if none, by city and space type; if none,
  return `not_evaluated`.
- If `rent < 0.5 × baseline`, return `status: "violation"`, `severity: "critical"`.
  Rent at exactly 50% passes.
- The result includes `rent`, `baseline`, `baselineSource`, `percentOfBaseline`
  and a plain-language `explanation`.

## Requirements

- Checker in `server/src/services/checkers/price.checker.ts`; model in
  `server/src/models/rentBaseline.model.ts`.
- No API endpoint; a future endpoint will call the checker.
- Tests in `server/tests/SCRUM-19-T-1_price.test.ts`, with the database mocked
  and no network calls.

## Acceptance criteria

1. A shared room under 50% of its baseline is flagged as a critical violation with comparison numbers.
2. A single room under 50% of its baseline is flagged as a critical violation.
3. A 1BR under 50% of its baseline is flagged as a critical violation.
4. A 2BR at a normal price passes.
5. Rent at exactly 50% of the baseline passes.
6. When no ZIP baseline exists, the city baseline is used.
7. When no baseline exists, the result is `not_evaluated`.
8. Invalid input (negative rent, unknown space type) is rejected.

## Tests

File: `server/tests/SCRUM-19-T-1_price.test.ts`
Setup for all: Vitest; `RentBaselineModel.findOne` mocked, no database connection.

- Criterion 1: `SCRUM-19-T-1 flags a shared room under 50% of its baseline`
- Criterion 2: `SCRUM-19-T-1 flags a single room under 50% of its baseline`
- Criterion 3: `SCRUM-19-T-1 flags a 1BR under 50% of its baseline`
- Criterion 4: `SCRUM-19-T-1 passes a 2BR at a normal price`
- Criterion 5: `SCRUM-19-T-1 passes rent at exactly 50% of the baseline`
- Criterion 6: `SCRUM-19-T-1 falls back to city when no ZIP baseline exists`
- Criterion 7: `SCRUM-19-T-1 returns not_evaluated when no baseline exists`
- Criterion 8: `SCRUM-19-T-1 rejects invalid input`
