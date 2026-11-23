---
id: SCRUM-69-T-1
story: SCRUM-69
sprint: 4
assignee: Devarsh Krishnan Jayakrishnan
estimate_hours: 6
---

# Backend Scan Persistence Service, Database Model and User Retrieval API

## Description

Serves SCRUM-69 (As a student, I want to save the results of my scans to look at later). This task adds the backend that stores a signed-in student's checked listings and gives them back: Clerk authentication on the server, a MongoDB saved-scan model, a persistence service, and authenticated `/api/scans` endpoints. Every saved scan belongs to one verified Clerk user, and nobody can read or delete another user's scans. Jira: SCRUM-79.

Out of scope: scoring a listing (SCRUM-70-T-2), the `/api/evaluate` orchestrator (SCRUM-70-T-1), checks for guests without an account, and the client screens that use this API (SCRUM-69-T-2).

## Specs

- Clerk auth middleware in `server/src/middleware/auth.middleware.ts`:
  - `requireClerkConfig` answers HTTP 503 with the error envelope when `CLERK_SECRET_KEY` or `CLERK_PUBLISHABLE_KEY` is not set, instead of crashing.
  - `clerkSession` runs `clerkMiddleware()` from `@clerk/express`, created on first use after the keys are checked.
  - `requireUser` reads the user ID with `getAuth(req)`, answers HTTP 401 when there is none, and otherwise puts it in `res.locals.userId`.
- Zod schemas in `server/src/schemas/savedScan.schema.ts`:
  - `saveScanRequestSchema` (strict object): `listingUrl` (http or https link, at most 2,048 characters), `rent` (positive number), `bedrooms` (`room`, `studio`, `1`, `2`, `3`, `4+`), `location` (2 to 200 characters), `landlord`, `payment` (one of the form's payment methods), `securityDeposit` and `applicationFee` (non-negative number or null), `contactPhone`, `description` (at most 5,000 characters), `photoCount` (0 to 10), `score` (integer 0 to 100) and `checks` (at most 20 of `{ id, title, detail, status }`, where status is `FLAG`, `UNKNOWN` or `OK`). Unknown fields are rejected.
  - The scan is stored as it was evaluated. This task does not score it.
  - `SaveScanRequest` and `ScanCheck` are inferred with `z.infer`. `SavedScanResponse` is the request shape plus `id` and `createdAt`.
- `validateBody(schema)` in `server/src/middleware/validateBody.middleware.ts` parses `req.body`, replaces it with the parsed value, and otherwise answers HTTP 400 with `details` holding Zod's flattened field errors.
- Model in `server/src/models/savedScan.model.ts`: Mongoose model `SavedScan` with `userId` (Clerk user ID), the request fields and `createdAt`, and a compound index `{ userId: 1, createdAt: -1 }`.
- Persistence service in `server/src/services/scanPersistence.service.ts`:
  - `saveScan(userId, scan)` saves and returns the scan.
  - `listScans(userId)` returns the user's scans, newest first, at most `SAVED_SCAN_LIST_LIMIT` (100).
  - `getScan(userId, id)` returns one scan or null.
  - `deleteScan(userId, id)` resolves true when it removed the user's scan, otherwise false.
  - Every query filters by `userId`. A malformed ID gives null or false without querying. The owner's user ID is never returned.
- Routes in `server/src/routes/scans.routes.ts`, mounted at `/api/scans` through `server/src/routes/index.ts`, with handlers in `server/src/controllers/scans.controller.ts`. Every route runs `requireClerkConfig`, `clerkSession` and `requireUser` first.
  - `POST /api/scans`: validates the body, saves the scan, answers HTTP 201 with `{ success: true, data: scan }`.
  - `GET /api/scans`: answers HTTP 200 with the user's scans.
  - `GET /api/scans/:id`: answers HTTP 200 with the scan, or HTTP 404 with `{ success: false, error: "We couldn't find that scan." }`.
  - `DELETE /api/scans/:id`: answers HTTP 200 with `{ success: true, data: { id } }`, or the same HTTP 404.
  - A database failure answers HTTP 500 with the error envelope.
- Config: `server/.env.example` documents `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. `server/src/index.ts` also loads `server/.env.local`, where `clerk env pull` writes the keys.
- `docs/specs/scans-api.md` documents authentication, the envelopes, the scan shape and each endpoint.

## Requirements

- Routes, controllers, services, models and middleware stay in their own directories. No database access in route or controller files (`docs/architecture.md`).
- Every POST body is validated with Zod before any business logic runs.
- Every response uses the `{ success, data }` / `{ success, error, details }` envelope.
- TypeScript strict mode, no `any`, and JSDoc with `@param` and `@returns` on every function, per `docs/style-guide.md`.
- Adds one runtime dependency to `server/package.json`: `@clerk/express`. No client changes.
- Tests live in `server/tests/SCRUM-69-T-1_savedScans.test.ts`, use Supertest against `app`, mock `@clerk/express` and the Mongoose model, and make zero network or database calls.

## Acceptance criteria

1. A request to any `/api/scans` route without a signed-in user gets HTTP 401 and the standard error envelope.
2. With `CLERK_SECRET_KEY` or `CLERK_PUBLISHABLE_KEY` unset, `/api/scans` answers HTTP 503 with the error envelope instead of crashing.
3. `POST /api/scans` with a valid body saves the scan under the signed-in user's ID and answers HTTP 201 with the saved scan, including `id` and `createdAt` and leaving out `userId`.
4. `POST /api/scans` with a missing, invalid or unknown field answers HTTP 400 with `details` naming the field, and saves nothing.
5. `GET /api/scans` returns only the signed-in user's scans, newest first, and at most 100 of them.
6. `GET /api/scans/:id` returns a scan to its owner, and answers HTTP 404 for another user's scan, an unknown ID or a malformed ID.
7. `DELETE /api/scans/:id` removes the owner's scan, and answers HTTP 404 for another user's scan or an unknown ID without deleting anything.
8. All tests run offline, with `@clerk/express` and the Mongoose model mocked.

## Tests

File: `server/tests/SCRUM-69-T-1_savedScans.test.ts`
Setup for all: `@clerk/express` is mocked so the signed-in user is the `x-test-user` request header. `server/src/models/savedScan.model.ts` is mocked with an in-memory stand-in for `create`, `find().sort().limit().lean()`, `findOne().lean()` and `deleteOne`, so the real persistence service, controllers and routes run. The Clerk keys are stubbed with `vi.stubEnv`. Grouped under `describe('SCRUM-69-T-1: saved scans API', ...)` with `[Criterion N]` prefixes per `docs/style-guide.md` §3.2.

- Criterion 1: `SCRUM-69-T-1 rejects signed-out requests` — sends `GET /api/scans`, `POST /api/scans`, `GET /api/scans/:id` and `DELETE /api/scans/:id` without the header; asserts HTTP 401 and `{ success: false, error: 'Log in to continue.' }` for each.
- Criterion 2: `SCRUM-69-T-1 answers 503 without Clerk keys` — clears `CLERK_SECRET_KEY`, then `CLERK_PUBLISHABLE_KEY`, and sends a signed-in `GET /api/scans` each time; asserts HTTP 503 with `success: false` and a string `error`.
- Criterion 3: `SCRUM-69-T-1 saves a scan for the signed-in user` — posts a valid scan as `user_a`; asserts HTTP 201, the response data matches the body plus a string `id` and an ISO `createdAt`, the data has no `userId`, and the stored row belongs to `user_a`.
- Criterion 4: `SCRUM-69-T-1 rejects invalid scans` — posts bodies with a missing `rent`, a `javascript:` link, an unknown payment method, a negative deposit, a score of 101, a check with status `MAYBE`, and an extra `userId` field; asserts HTTP 400 with `success: false`, the bad field named in `details`, and no stored rows.
- Criterion 5: `SCRUM-69-T-1 lists only the user's scans, newest first` — saves scans for `user_a` and `user_b`; asserts `user_a` gets only theirs, newest first; then saves 101 scans for `user_c` and asserts 100 come back.
- Criterion 6: `SCRUM-69-T-1 opens only the owner's scan` — asserts the owner gets HTTP 200 with the scan, and another user, an unknown valid ID and the malformed ID `nope` each get HTTP 404 with the not-found envelope.
- Criterion 7: `SCRUM-69-T-1 deletes only the owner's scan` — asserts another user's delete and an unknown ID answer HTTP 404 and leave the row in place; the owner's delete answers HTTP 200 with `{ id }` and removes it.
- Criterion 8: `SCRUM-69-T-1 runs offline` — asserts the mocked model handled the saves, and that `fetch` was never called during the suite.
