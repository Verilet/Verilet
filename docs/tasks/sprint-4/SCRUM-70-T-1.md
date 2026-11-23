---
id: SCRUM-70-T-1
story: SCRUM-70
sprint: 4
assignee: Aubrey Hayes
estimate_hours: 4
---

# Listing evaluation orchestrator service and POST /api/evaluate endpoint

## Description

Serves SCRUM-70 (orchestrate full listing evaluation). This task implements the backend `POST /api/evaluate` route, controller, validation middleware, and orchestrator service in `server/src/services/evaluateOrchestrator.service.ts`. It validates incoming listing payloads using Zod and executes all independent verification workers concurrently using `Promise.allSettled()`, ensuring timeouts or crashes in any single worker are isolated and do not fail the request. Out of scope: scoring point math (SCRUM-70-T-2) and frontend UI (SCRUM-70-T-3).

## Specs

- **Request Schema (`server/src/schemas/evaluate.schema.ts`):**
  - `EvaluateRequestSchema`: Zod object schema validating:
    - `listingUrl`: `z.string().url()` (must be valid HTTP/HTTPS URL).
    - `rent`: `z.number().positive().finite()` (monthly rent).
    - `bedrooms`: `z.enum(['room', 'studio', '1', '2', '3', '4+'])`.
    - `location`: `z.string().trim().min(1)` (address or city string).
    - `landlord`: `z.string().trim().max(120).nullish()`.
    - `payment`: `z.enum(['bank-transfer', 'check', 'rental-platform', 'zelle-venmo', 'cash', 'wire', 'gift-card', 'crypto', 'other']).nullish()`.
    - `securityDeposit`: `z.number().min(0).finite().nullish()`.
    - `applicationFee`: `z.number().min(0).finite().nullish()`.
    - `contactPhone`: `z.string().trim().nullish()`.
    - `description`: `z.string().trim().max(5000).nullish()`.
  - Export derived TypeScript type `EvaluateRequest = z.infer<typeof EvaluateRequestSchema>`.
- **Validation Middleware (`server/src/middleware/validate.middleware.ts`):**
  - `validateBody(schema: ZodSchema)`: Express middleware function validating `req.body`. On parsing failure, returns HTTP 400 with `{ success: false, error: 'Validation failed', details: error.format() }`.
- **Orchestrator Service (`server/src/services/evaluateOrchestrator.service.ts`):**
  - `orchestrateEvaluation(input: EvaluateRequest)`: Dispatches the 9 independent verification workers concurrently via `Promise.allSettled()`:
    1. `price`: `checkPrice({ rent: input.rent, spaceType, zip })` (adapting `bedrooms` to `spaceType` and extracting 5-digit zip from `location`).
    2. `securityDeposit`: `evaluateSecurityDeposit({ rent: input.rent, deposit: input.securityDeposit })`.
    3. `applicationFee`: `evaluateApplicationFee({ applicationFee: input.applicationFee })`.
    4. `untraceablePayment`: `detectUntraceablePayment(input.description)`.
    5. `gisQuery`: `evaluateGisQuery({ address: input.location })`.
    6. `landUse`: `evaluateLandUse({ useCode, useDescription })` (chained with `gisQuery` parcel records when available, defaulting safely to null if unverified or failed).
    7. `contactPhone`: `evaluateContactPhone(input.contactPhone)` (stubbed/delegated to phone flags service).
    8. `agencyStanding`: `verifyAgencyStanding(input.landlord)` (stubbed/delegated to agency verification service).
    9. `listingSearch`: `listingSearch(input)` (stubbed/delegated to duplicate listing search service).
  - Enforces a 5,000ms timeout per worker invocation.
  - Normalizes results: fulfilled promises retain their output; rejected or timed-out promises return fallback `{ status: 'skipped', flag: null, error: 'WORKER_FAILED' }`.
  - Resolves to `{ success: true, data: { rawChecks } }` with `rawChecks` containing all 9 results keyed by checker name.
- **Controller & Router:**
  - `server/src/controllers/evaluate.controller.ts`: Defines `evaluateListing(req: Request, res: Response)` calling `orchestrateEvaluation(req.body)` and returning HTTP 200 with result payload.
  - `server/src/routes/evaluate.routes.ts`: Defines router with `router.post('/', validateBody(EvaluateRequestSchema), evaluateListing)`.
  - Mounted at `/api/evaluate` in `server/src/routes/index.ts`.

## Requirements

- Concurrency must use `Promise.allSettled()` to prevent single-point worker failures.
- No direct database connections in route or controller files per `docs/architecture.md`.
- Input validation and derived types must use Zod (`server/src/schemas/evaluate.schema.ts`).
- All unit tests must be located in `server/tests/SCRUM-70-T-1_evaluateOrchestrator.test.ts` with zero external network dependencies.
- Stubs for unmerged workers must be placed in their respective service files with proper types so the build passes without errors.
- Pre-commit formatting and linting (`npm run format:check` and `npm --prefix server run lint`) must pass cleanly.

## Acceptance criteria

1. `POST /api/evaluate` accepts a valid listing payload and returns HTTP 200 with standard envelope `{ success: true, data: { rawChecks } }` containing keyed results for all 9 checkers.
2. Malformed payloads (e.g., negative rent, invalid URL, or invalid bedroom category) return HTTP 400 with `{ success: false, error: 'Validation failed' }` and detailed validation issues.
3. All 9 worker functions are dispatched concurrently via `Promise.allSettled()` rather than sequentially.
4. If one or more workers throw an unhandled exception or reject, the endpoint still returns HTTP 200, isolating the failure and marking those individual checks with fallback `{ status: 'skipped', flag: null, error: 'WORKER_FAILED' }`.
5. If a worker hangs or exceeds the 5,000ms timeout, the check safely returns fallback `{ status: 'skipped', flag: null, error: 'WORKER_FAILED' }` without delaying other checks or failing the HTTP request.

## Tests

File: `server/tests/SCRUM-70-T-1_evaluateOrchestrator.test.ts`
Setup for all: Supertest app instance with mocked worker functions using Vitest `vi.mock()` / `vi.spyOn()`, ensuring zero live database or network calls. All test assertions follow `docs/style-guide.md §3.2`, prefixed with `[Criterion N]`.

- Criterion 1: `SCRUM-70-T-1 accepts valid listing payload and returns 200 with rawChecks` — sends a complete valid listing body, asserts HTTP 200, `success: true`, and `data.rawChecks` contains keyed results for all 9 checkers.
- Criterion 2: `SCRUM-70-T-1 rejects malformed payload with HTTP 400 and validation errors` — sends payloads with invalid URL, negative rent, and invalid types; asserts HTTP 400, `success: false`, and detailed Zod validation messages.
- Criterion 3: `SCRUM-70-T-1 dispatches all 9 workers concurrently` — verifies via mock execution order and delayed execution tracking that workers execute in parallel.
- Criterion 4: `SCRUM-70-T-1 isolates worker rejection and returns 200 with skipped fallback` — configures one worker to throw an exception; asserts HTTP 200, healthy workers retain results, and failed worker returns `{ status: 'skipped', flag: null, error: 'WORKER_FAILED' }`.
- Criterion 5: `SCRUM-70-T-1 isolates worker timeout and returns 200 with skipped fallback` — configures a worker to hang past the 5,000ms timeout; asserts HTTP 200 and timed-out worker returns `{ status: 'skipped', flag: null, error: 'WORKER_FAILED' }`.
