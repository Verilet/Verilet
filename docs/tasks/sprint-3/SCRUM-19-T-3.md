---
id: SCRUM-19-T-3
story: SCRUM-19
sprint: 3
assignee: Yifei Peng
estimate_hours: 3
---

# Read rent data from the database named in RENT_DB_NAME

## Description

Serves SCRUM-19 (flag listings with suspiciously low rent). The price checker from
SCRUM-19-T-1 always reads average rents from the live `averagePrice` database on the shared
Atlas cluster, so trying a query or a data change risks the real data. This task lets the
server read rent data from another database, chosen with the `RENT_DB_NAME` environment
variable, and documents `test_dataBase`, a copy of `averagePrice` made for that purpose.
Out of scope: changes to the price-check logic, editing rent data, keeping `test_dataBase`
in sync automatically, and tests that connect to Atlas.

## Specs

- `getRentDbName(env)` in `server/src/config/rentDatabase.ts` returns `env.RENT_DB_NAME`
  without surrounding spaces. `env` defaults to `process.env`.
- When `RENT_DB_NAME` is unset, empty, or only spaces, it returns `averagePrice`.
- A name MongoDB does not allow (contains a space or any of `/ \ . " $ * < > : | ?`, or is
  longer than 63 characters) throws an `Error` whose message contains `RENT_DB_NAME`.
- `SantaCruzRentModel` and `SanJoseRentModel` in `server/src/models/rentBaseline.model.ts`
  use the database returned by `getRentDbName()` when the module loads. Their collection
  names stay `santaCruz` and `sanJose-sunnyVale-santaClara`.
- `test_dataBase` on the `verilet-shared` cluster is a copy of `averagePrice`.
  `docs/test-database.md` explains what it is for, how to select it with `RENT_DB_NAME`,
  and how to re-copy it.
- `server/.env.example` lists `# RENT_DB_NAME=test_dataBase`, commented out.

## Requirements

- Builds on the rent models from SCRUM-19-T-1 and is merged after it.
- The name is validated with Zod. No new dependencies.
- With `RENT_DB_NAME` unset, behavior is unchanged: rent data comes from `averagePrice`, and
  the SCRUM-19-T-1 tests keep passing.
- No committed file contains a real connection string, and no `.env` file is committed.
- Tests in `server/tests/SCRUM-19-T-3_rentDatabase.test.ts` use Vitest, with no database
  connection and no network calls.

## Acceptance criteria

1. With `RENT_DB_NAME` unset, `getRentDbName` returns `averagePrice`.
2. With `RENT_DB_NAME` empty or only spaces, `getRentDbName` returns `averagePrice`.
3. With `RENT_DB_NAME` set to `test_dataBase`, with or without surrounding spaces, `getRentDbName` returns `test_dataBase`.
4. An invalid name (`average.Price`, `my db`, or 64 characters) throws an error that mentions `RENT_DB_NAME`.
5. With `RENT_DB_NAME=test_dataBase`, both rent models use the `test_dataBase` database and keep their collection names.
6. With `RENT_DB_NAME` unset, both rent models use the `averagePrice` database.

## Tests

File: `server/tests/SCRUM-19-T-3_rentDatabase.test.ts`
Setup for all: Vitest; environment set with `vi.stubEnv` or a plain object, no database connection.

- Criterion 1: `SCRUM-19-T-3 uses averagePrice when RENT_DB_NAME is unset`
- Criterion 2: `SCRUM-19-T-3 uses averagePrice when RENT_DB_NAME is empty`
- Criterion 3: `SCRUM-19-T-3 uses the database named in RENT_DB_NAME`
- Criterion 4: `SCRUM-19-T-3 rejects an invalid database name`
- Criterion 5: `SCRUM-19-T-3 rent models read from RENT_DB_NAME`
- Criterion 6: `SCRUM-19-T-3 rent models read from averagePrice by default`
