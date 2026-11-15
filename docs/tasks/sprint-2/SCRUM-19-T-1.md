---
id: SCRUM-19-T-1
story: SCRUM-19
sprint: 2
assignee: Yifei Peng
estimate_hours: 6
---

# Flag a listing whose rent is under half the local average

## Description

Serves SCRUM-19. Fraudulent listers post rentals far below market rate to lure students.
This checker compares a listing's rent with the typical rent for its space type and
location, and flags rent under 50% of that baseline as a critical price outlier.

## Specs

- Input (Zod-validated): `rent` (positive number), `spaceType`
  (`shared_room` | `single_room` | `studio` | `1br` | `2br` | `3br` | `4br`), optional `zip`
  (5 digits), optional `region` (`santa_cruz` | `san_jose`).
- Baselines come from the `averagePrice` database in MongoDB Atlas: the `santaCruz`
  collection for Santa Cruz County and the `sanJose-sunnyVale-santaClara` collection for the
  San Jose-Sunnyvale-Santa Clara area (fields `zipCode`, `roomType`, `price`).
- Region: the given `region`; else the first collection containing the ZIP (Santa Cruz
  first); a ZIP in neither collection returns `not_evaluated`; with no ZIP and no region,
  the result is `not_evaluated`.
- Each space type maps to one or more Atlas `roomType` labels per region; a type with no
  labels is never flagged.
- Lookup order within the region: average for the listing's ZIP; if none, the area-wide
  average (records without a `zipCode`); if none, return `not_evaluated`. When several
  records match, the lowest price is used.
- If `rent < 0.5 × baseline`, return `status: "violation"`, `severity: "critical"`.
  Rent at exactly 50% passes.
- The result includes `rent`, `baseline`, `baselineSource` (`zip` | `county`), `region`,
  `percentOfBaseline` and a plain-language `explanation`.

## Requirements

- Checker in `server/src/services/checkers/averagePrice.checker.ts`; models in
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
6. When no ZIP baseline exists, the area-wide average is used.
7. When no baseline exists, including for a ZIP outside both areas, the result is `not_evaluated`.
8. Invalid input (negative rent, unknown space type) is rejected.
9. A ZIP found only in the San Jose collection is checked against San Jose prices.
10. A listing with a `region` and no ZIP is checked against that region's area-wide average.
11. Studio, 3BR and 4BR listings are looked up by their own room type.

## Tests

File: `server/tests/SCRUM-19-T-1_price.test.ts`
Setup for all: Vitest; `SantaCruzRentModel` and `SanJoseRentModel` queries mocked, no database connection.

- Criterion 1: `SCRUM-19-T-1 flags a shared room under 50% of its baseline`
- Criterion 2: `SCRUM-19-T-1 flags a single room under 50% of its baseline`
- Criterion 3: `SCRUM-19-T-1 flags a 1BR under 50% of its baseline`
- Criterion 4: `SCRUM-19-T-1 passes a 2BR at a normal price`
- Criterion 5: `SCRUM-19-T-1 passes rent at exactly 50% of the baseline`
- Criterion 6: `SCRUM-19-T-1 falls back to the county-wide average when no ZIP baseline exists`
- Criterion 7: `SCRUM-19-T-1 returns not_evaluated when no baseline exists`
- Criterion 8: `SCRUM-19-T-1 rejects invalid input`
- Criterion 9: `SCRUM-19-T-1 uses San Jose data for a San Jose ZIP`
- Criterion 10: `SCRUM-19-T-1 uses the given region when there is no ZIP`
- Criterion 11: `SCRUM-19-T-1 looks up studio, 3BR and 4BR listings by their own room type`
