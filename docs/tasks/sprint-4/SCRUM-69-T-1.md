---
id: SCRUM-69-T-1
story: SCRUM-69
sprint: 4
assignee: Devarsh Krishnan Jayakrishnan
estimate_hours: 6
---

# Save and return each signed-in student's scans through /api/scans

## Description

Serves SCRUM-69 (As a student, I want to save the results of my scans to look at later). This task adds the backend that stores a signed-in student's checked listings and gives them back: Clerk authentication on the server, a MongoDB saved-scan model, a persistence service, and authenticated `/api/scans` endpoints. Every saved scan belongs to one verified Clerk user, and nobody can read or delete another user's scans. Jira: SCRUM-79.

Out of scope: scoring listings and the client screens.

## Specs

- Every `/api/scans` request is checked in this order:
  - If `CLERK_SECRET_KEY` or `CLERK_PUBLISHABLE_KEY` is not set, it answers HTTP 503 with `{ "success": false, "error": "Sign-in is not configured on the server." }` instead of crashing.
  - The Clerk session token (`Authorization: Bearer <token>`) is read with `clerkMiddleware()` and `getAuth(req)` from `@clerk/express`. Without a signed-in user it answers HTTP 401 with `{ "success": false, "error": "Log in to continue." }`.
- `POST /api/scans` body, checked by `saveScanRequestSchema` in `server/src/schemas/savedScan.schema.ts` (a strict object, so unknown fields such as `userId` are rejected):
  - `listingUrl`: http or https link, at most 2,048 characters.
  - `rent`: positive number. `bedrooms`: `room`, `studio`, `1`, `2`, `3` or `4+`.
  - `location`: 2 to 200 characters. `landlord`, `contactPhone`: strings, may be empty. `description`: at most 5,000 characters.
  - `payment`: `bank-transfer`, `check`, `rental-platform`, `zelle-venmo`, `cash`, `wire`, `gift-card`, `crypto` or `other`.
  - `securityDeposit`, `applicationFee`: a number of 0 or more, or `null`. `photoCount`: whole number 0 to 10.
  - `score`: whole number 0 to 100. `checks`: at most 20 of `{ id, title, detail, status }`, where `status` is `FLAG`, `UNKNOWN` or `OK`.
  - An invalid body answers HTTP 400 with `{ "success": false, "error": "Some details are missing or invalid.", "details": ... }`, where `details` is Zod's flattened errors naming each bad field. Nothing is saved.
  - A valid body is saved as it was evaluated (this task does not score listings) and answers HTTP 201 with `{ "success": true, "data": scan }`.
- A returned scan is the body's fields plus `id` (string) and `createdAt` (ISO timestamp). The owner's `userId` is stored but never returned.
- `GET /api/scans` answers HTTP 200 with the signed-in user's scans, newest first, at most 100.
- `GET /api/scans/:id` answers HTTP 200 with the scan. Another user's scan, an unknown ID, or a malformed ID such as `nope` answers HTTP 404 with `{ "success": false, "error": "We couldn't find that scan." }`.
- `DELETE /api/scans/:id` deletes the scan and answers HTTP 200 with `{ "success": true, "data": { "id": "<id>" } }`. Another user's scan or an unknown ID answers the same HTTP 404 and deletes nothing.
- If the database fails, the request answers HTTP 500 with the error envelope: `"We couldn't save that scan."` for `POST` and `"We couldn't load your scans."` for `GET /api/scans`.
- Scans are stored by the Mongoose model `SavedScanModel` in `server/src/models/savedScan.model.ts` (collection `savedscans`, index `{ userId: 1, createdAt: -1 }`), through `saveScan`, `listScans`, `getScan` and `deleteScan` in `server/src/services/scanPersistence.service.ts`.
- `docs/specs/scans-api.md` documents the API.

## Requirements

- Routes in `server/src/routes/scans.routes.ts`, mounted at `/api/scans` through `server/src/routes/index.ts`. Handlers in `server/src/controllers/scans.controller.ts`, auth and body checks in `server/src/middleware/`. No database access in route or controller files (`docs/architecture.md`).
- Every query is limited to the signed-in user's Clerk user ID, so one student can never read or delete another's scans.
- Every POST body is validated with Zod before anything is saved. Every response uses the `{ success, data }` / `{ success, error, details }` envelope.
- Adds one runtime dependency, `@clerk/express`, to `server/package.json`. `server/.env.example` documents `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`, and `server/src/index.ts` also loads `server/.env.local`. No client changes.
- TypeScript strict mode, no `any`, and JSDoc with `@param` and `@returns` on every function, per `docs/style-guide.md`. Existing server tests must keep passing.
- Tests live in `server/tests/SCRUM-69-T-1_savedScans.test.ts` and run offline: `@clerk/express` and `SavedScanModel` are mocked, with no network or database calls.

## Acceptance criteria

1. A request to any `/api/scans` route without a signed-in user answers HTTP 401 with `{ "success": false, "error": "Log in to continue." }`.
2. With `CLERK_SECRET_KEY` or `CLERK_PUBLISHABLE_KEY` unset, `/api/scans` answers HTTP 503 with the error envelope instead of crashing.
3. `POST /api/scans` with a valid body saves the scan under the signed-in user's ID and answers HTTP 201 with the saved scan, including `id` and `createdAt` and leaving out `userId`.
4. `POST /api/scans` with a missing, invalid or unknown field answers HTTP 400 with `details` naming the field, and saves nothing.
5. `GET /api/scans` returns only the signed-in user's scans, newest first, and at most 100 of them.
6. `GET /api/scans/:id` returns a scan to its owner, and answers HTTP 404 for another user's scan, an unknown ID or a malformed ID.
7. `DELETE /api/scans/:id` removes the owner's scan, and answers HTTP 404 for another user's scan or an unknown ID without deleting anything.
8. When the database fails, `POST /api/scans` and `GET /api/scans` answer HTTP 500 with the error envelope instead of crashing.

## Tests

File: `server/tests/SCRUM-69-T-1_savedScans.test.ts`
Setup for all: Supertest sends requests to `app`. `@clerk/express` is mocked so the signed-in user is the `x-test-user` request header. `SavedScanModel` is mocked with an in-memory stand-in for `create`, `find().sort().limit().lean()`, `findOne().lean()` and `deleteOne`, so the real persistence service, controller, routes and validation run. The Clerk keys are set with `vi.stubEnv`. Test names start with the task ID and the criterion, grouped under `describe('SCRUM-69-T-1: saved scans API', ...)`.

| Test name                                                                                                            | Setup                                                                                                                                                      | Asserts                                                                                                                        | Criterion |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------- |
| `SCRUM-69-T-1 [Criterion 1] rejects signed-out requests on every route`                                              | `GET`, `POST`, `GET /:id` and `DELETE /:id` without `x-test-user`                                                                                          | each is HTTP 401 with `{ success: false, error: 'Log in to continue.' }`; nothing saved                                        | 1         |
| `SCRUM-69-T-1 [Criterion 2] answers 503 when CLERK_SECRET_KEY is not set` (and the same for `CLERK_PUBLISHABLE_KEY`) | clear one key, signed-in `GET /api/scans`                                                                                                                  | HTTP 503, `success: false`, a string `error`                                                                                   | 2         |
| `SCRUM-69-T-1 [Criterion 3] saves a scan for the signed-in user`                                                     | `POST` a valid scan as `user_a`                                                                                                                            | HTTP 201; data matches the body plus a string `id` and an ISO `createdAt`; no `userId` in data; stored row belongs to `user_a` | 3         |
| `SCRUM-69-T-1 [Criterion 4] rejects <case> and saves nothing`                                                        | `POST` with a missing `rent`, a `javascript:` link, an unknown payment, a negative deposit, a score of 101, a check with status `MAYBE`, an extra `userId` | HTTP 400, `success: false`, the field named in `details`, no stored rows                                                       | 4         |
| `SCRUM-69-T-1 [Criterion 5] lists only the user's scans, newest first`                                               | save 2 scans for `user_a` and 1 for `user_b`                                                                                                               | `user_a` gets their 2 scans, newest first                                                                                      | 5         |
| `SCRUM-69-T-1 [Criterion 5] lists at most 100 scans, the newest`                                                     | save 101 scans for `user_c`                                                                                                                                | 100 come back, newest first                                                                                                    | 5         |
| `SCRUM-69-T-1 [Criterion 6] opens only the owner's scan`                                                             | save a scan as `user_a`, then open it as `user_a`, as `user_b`, an unknown ID and `nope`                                                                   | owner gets HTTP 200 with the scan; the other three get HTTP 404 with the not-found envelope                                    | 6         |
| `SCRUM-69-T-1 [Criterion 7] deletes only the owner's scan`                                                           | save a scan as `user_a`, delete it as `user_b`, an unknown ID, then as `user_a`                                                                            | the first two are HTTP 404 and the row stays; the owner's is HTTP 200 with `{ id }` and the row is gone                        | 7         |
| `SCRUM-69-T-1 [Criterion 8] answers 500 when the database fails`                                                     | make the mocked model throw, then `POST` and `GET`                                                                                                         | HTTP 500 with `"We couldn't save that scan."` and `"We couldn't load your scans."`                                             | 8         |
