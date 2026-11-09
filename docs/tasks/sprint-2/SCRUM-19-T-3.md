---
id: SCRUM-19-T-3
story: SCRUM-19
sprint: 2
assignee: Chester
estimate_hours: 2
---

# Test database for rent baseline data

## Description

Serves SCRUM-19. The price checker reads average rents from the `averagePrice` database
on the shared Atlas cluster. This task adds `test_dataBase`, a copy of that data, so the team
can try queries and data edits without touching the live rent data. It also documents what
the test database is for and how to re-copy it. Out of scope: changing the rent models to
read `RENT_DB_NAME` (follows SCRUM-19-T-1, which adds the models), integration tests that
use the test database, changing any rent data, and CI setup.

## Specs

- `test_dataBase` lives on the `verilet-shared` Atlas cluster and has the same collections
  as `averagePrice`: `santaCruz` (76 documents) and `sanJose-sunnyVale-santaClara`
  (321 documents). It is copied with MongoDB Database Tools (`mongodump` and
  `mongorestore --nsFrom 'averagePrice.*' --nsTo 'test_dataBase.*' --drop`), which only
  read from `averagePrice`.
- `docs/test-database.md` explains what `test_dataBase` is for, how to point the server at it
  with `RENT_DB_NAME`, and the commands to re-copy it from `averagePrice`.
- `server/.env.example` documents `RENT_DB_NAME` as a commented-out line,
  `# RENT_DB_NAME=test_dataBase`, so copying the example keeps the default `averagePrice`.

## Requirements

- No new dependencies. No changes to application code.
- No committed file contains a real connection string. No `.env` file is committed.
- Tests in `server/tests/SCRUM-19-T-3_testDatabase.test.ts` read the committed files;
  no database connection and no network calls.

## Acceptance criteria

1. `docs/test-database.md` explains what `test_dataBase` is for.
2. `docs/test-database.md` gives re-copy commands that restore only into `test_dataBase`.
3. `server/.env.example` documents `RENT_DB_NAME` as a commented-out line with the exact name `test_dataBase`.
4. Neither `docs/test-database.md` nor `server/.env.example` contains a real connection string.

## Tests

File: `server/tests/SCRUM-19-T-3_testDatabase.test.ts`
Setup for all: Vitest; files read with `node:fs`, no database connection.

- Criterion 1: `SCRUM-19-T-3 docs explain what test_dataBase is for`
- Criterion 2: `SCRUM-19-T-3 docs restore only into test_dataBase`
- Criterion 3: `SCRUM-19-T-3 env example documents RENT_DB_NAME as commented out`
- Criterion 4: `SCRUM-19-T-3 no committed file contains a real connection string`
