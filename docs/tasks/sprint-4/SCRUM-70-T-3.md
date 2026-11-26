---
id: SCRUM-70-T-3
story: SCRUM-70
sprint: 4
assignee: Aubrey Hayes
estimate_hours: 4
---

# End-to-end listing evaluation integration, loading overlay, and diagnostics UI

## Description

Serves SCRUM-70 (connect frontend to real evaluation API, wire backend scoring into `POST /api/evaluate`, and display diagnostic findings). This final task of SCRUM-70 completes the end-to-end user flow from listing submission to scored results:

- **Backend integration (`server/`):** Wires `calculateListingScore(rawChecks)` from `SCRUM-70-T-2` into `POST /api/evaluate`, returns `score`, `rating`, `summary`, `checks`, and `rawChecks` in the HTTP 200 JSON envelope, and aligns the obfuscated contact flag (`OBFUSCATED_CONTACT`) across `phoneFlags.service.ts` and `scoringEngine.service.ts` so future contact-obfuscation checks map directly to the scoring engine.
- **Frontend integration (`client/`):** Updates `client/src/services/scanService.ts` to call `POST /api/evaluate` using native `fetch` with `application/json`, adds an accessible turning-gear loading overlay on `ListingForm` (respecting `prefers-reduced-motion`), updates `ResultsView` and shared scan helpers (`types.ts`, `risk.ts`, `Chip.tsx`, `guide.ts`, `scanStorage.ts`, `share.ts`, `App.tsx`, `HomeView.tsx`, `ScansView.tsx`) to render real check statuses (`FLAG`, `UNKNOWN`, `OK`, `SKIPPED`), matched evidence, score impact, and a non-persisted neutral `INSUFFICIENT_DATA` view while preserving the existing site color palette and `"More details"` layout.

Out of scope: implementing `server/src/services/contactObfuscation.service.ts` and wiring it into `evaluateOrchestrator.service.ts` (`SCRUM-16-T-2`), `multer` / `multipart/form-data` photo uploads and cross-platform reverse image matching inside `listingSearch.service.ts` (`SCRUM-64`), and redesigning existing site color tokens.

## Specs

- **Backend Scoring & Schema Wiring (`server/`):**
  - `server/src/schemas/evaluate.schema.ts`:
    - Keeps `EvaluateRequestSchema` (`application/json`, preserving `SCRUM-70-T-1` request compatibility) and `RawChecks` intact.
    - Separates `OrchestrationResponse` (`{ success: true, data: { rawChecks } }`, returned by `orchestrateEvaluation`) from `EvaluateResponse` (`{ success: true, data: ScoreResult & { rawChecks } }`, returned by `POST /api/evaluate`), so `SCRUM-70-T-1` direct orchestrator callers continue to type-check cleanly.
  - `server/src/controllers/evaluate.controller.ts`:
    - Calls `orchestrateEvaluation(req.body)` and `calculateListingScore(rawChecks)` and returns HTTP 200 with `{ success: true, data: { ...scoreResult, rawChecks } }`.
  - **Obfuscated Contact Flag Alignment (`server/src/services/`):**
    - Updates `phoneFlags.service.ts` (`PhoneFlag` union: `'NON_LOCAL_AREA_CODE' | 'INTERNATIONAL_PHONE_NUMBER' | 'OBFUSCATED_CONTACT' | null`), `scoringEngine.service.ts` (`normalizeContactPhone`), and `server/tests/SCRUM-70-T-2_scoringEngine.test.ts` to use `'OBFUSCATED_CONTACT'` instead of `'OBFUSCATED_PHONE_NUMBER'`.
    - Updates `normalizeContactPhone` in `scoringEngine.service.ts` to extract evidence safely using type-narrowed union checks: `('evidence' in data && typeof data.evidence === 'string' ? data.evidence : null) ?? ('areaCode' in data && data.areaCode ? 'Area code: ' + data.areaCode : null)`, so future `SCRUM-16-T-2` payloads with `evidence` and without `areaCode` normalize cleanly.

- **Frontend API Client (`client/src/services/scanService.ts`):**
  - Replaces the placeholder delay/scoring inside `checkListing(input)` with a native `fetch` `POST` request to `${readClientEnv().apiUrl}/api/evaluate` (`headers: { 'Content-Type': 'application/json' }`, no Axios).
  - Serializes the validated `ListingInput` fields (`listingUrl`, `rent`, `bedrooms`, `location`, `landlord`, `payment`, `securityDeposit`, `applicationFee`, `contactPhone`, `description`), omitting `photos` (left on `ListingForm` for UI/schema compatibility until `SCRUM-64`).
  - Enforces a `10_000`ms client timeout (`AbortSignal.timeout(10_000)`), throws an `Error` on non-2xx responses or invalid payloads, parses `{ success: true, data: { score, rating, summary, checks } }` with Zod (ignoring extra fields like `rawChecks`), and returns `{ ...input, id, createdAt, score, rating, summary, checks }` as a `ScanResult`.
  - Keeps `scoreListing` exported returning `{ score: number; rating: Exclude<Rating, 'INSUFFICIENT_DATA'>; summary: string; checks: ScanCheck[] }` (preserving numeric `score` for existing unit tests) and updates `mockScans.ts`, `lib.test.ts` (adding `rating` to `SCAN`), `App.test.tsx` (ensuring `seedScan` recomputes `rating: ratingFromScore(score)` after score overrides), and `SCRUM-48-T-7_landing.test.tsx` so all existing tests stay compatible and green.

- **Shared Types, Risk Helpers, Persistence, & Chips (`client/src/`):**
  - `client/src/types.ts`:
    - `Rating`: `'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA'`.
    - `CheckStatus`: `'FLAG' | 'UNKNOWN' | 'OK' | 'SKIPPED'`.
    - `ScanCheck`: `{ id, title, detail, status, scoreImpact: number, evidence: string | null }`.
    - `ScanResult`: updates `score: number | null`, adds `rating: Rating`, and adds optional `summary?: string`.
  - `client/src/lib/risk.ts`, `client/src/components/Chip.tsx`, `client/src/content/guide.ts`:
    - Updates `ratingFromScore(score: number | null): Rating` and `ratingTone(score: number | null): Tone` to handle `null` (`'INSUFFICIENT_DATA'` / `'neutral'`).
    - Maps `INSUFFICIENT_DATA` in `RATING_TONE` to `'neutral'`, `RATING_LABEL` to `'INSUFFICIENT DATA'`, and `RATING_HEADLINE` to `{ title, advice }` explaining that too few listing details were available to calculate a risk score.
    - Maps `SKIPPED` in `STATUS_TONE` to `'neutral'` and documents `SKIPPED` in `GUIDE.legend`.
  - `client/src/App.tsx`, `client/src/views/HomeView.tsx`, `client/src/views/ScansView.tsx`, `client/src/lib/scanStorage.ts`, `client/src/lib/share.ts`:
    - **Do not save `INSUFFICIENT_DATA` scans:** In `App.tsx` `handleSubmit`, if `scan.rating === 'INSUFFICIENT_DATA' || scan.score === null`, do not append `scan` to `scans` (so it is excluded from `sessionStorage`, `HomeView` Recent scans, and `ScansView` My scans); pass it to `/results/:scanId` via router `state` so `ResultsRoute` renders it immediately after submission (with `backLabel="← Check another listing"` and `backTo="/check"` since it is not in `My scans`).
    - In `scanStorage.ts`, `saveScans` filters out any scan where `score === null || rating === 'INSUFFICIENT_DATA'`. `storedScansSchema` keeps `score: z.number()` while allowing `'SKIPPED'` status and optional `rating`, `summary`, `scoreImpact`, and `evidence` for backward compatibility, and `loadScans()` backfills missing legacy fields (`rating: scan.rating ?? ratingFromScore(scan.score)`, `scoreImpact: check.scoreImpact ?? 0`, `evidence: check.evidence ?? null`, and `photos: []`) so returned items satisfy `ScanResult[]`.
    - `HomeView.tsx`, `ScansView.tsx`, `ResultsView.tsx`, and `share.ts` prefer `scan.rating ?? ratingFromScore(scan.score)`, and `ScansView.tsx` keeps the 4 existing filters (`All`, `High risk`, `Medium risk`, `Low risk`) while guarding `scan.score === null`.
    - `shareText` in `share.ts` safely omits `(null/100)` if ever called on a scan with `score === null`.

- **Check Form Loading Overlay (`client/src/components/ListingForm.tsx` & `client/src/styles/form.css`):**
  - Wraps form controls inside `<fieldset className="listing-form__fieldset" disabled={submitting}>` (styled cleanly so flex layout is preserved) and guards `handleAutofill` with `if (submitting || autofilling) { return; }`, disabling all underlying inputs, Autofill, and submit controls while `submitting` is `true`.
  - Only when `submitting` is `true`, mounts an accessible loading overlay over the form (`role="status"`, `aria-live="polite"`, `aria-busy="true"`) using an opaque/high-contrast surface background (`var(--color-card)` / `var(--color-surface)`), a turning gear SVG (`aria-hidden="true"`), and text indicating checks are running—not mounted when idle so the existing autofill `role="status"` region remains unique.
  - Respects `prefers-reduced-motion: reduce` via both CSS (`@media (prefers-reduced-motion: reduce)`) and `prefersReducedMotion()` from `client/src/lib/motion.ts`, omitting spinning animation classes and rendering a calm, static loading indicator.

- **Results Page Breakdown (`client/src/views/ResultsView.tsx` & `client/src/styles/results.css`):**
  - Preserves the existing `"More details"` toggle (`defaultExpanded={loggedIn}`) and non-expandable check list layout inside `"What we checked"`.
  - Prefers `const rating = scan.rating ?? ratingFromScore(scan.score)` and narrows `scan.score !== null` before rendering score values.
  - When `rating === 'INSUFFICIENT_DATA' || scan.score === null`, displays the neutral `INSUFFICIENT DATA` chip, `RATING_HEADLINE.INSUFFICIENT_DATA.title` (`<h1>`), `scan.summary ?? RATING_HEADLINE.INSUFFICIENT_DATA.advice`, and `"Check another listing"`, while omitting `"More details"`, `"Share result"`, and `.card--details` from the DOM (do not render with `hidden`).
  - For `LOW`, `MEDIUM`, and `HIGH` ratings, displays `RatingChip`, `RATING_HEADLINE[rating].title` (`<h1>`), and `RATING_HEADLINE[rating].advice` on the summary card; inside `"More details"`, renders `scan.summary` (when present), `{score} / 100`, the progress bar, and each check row showing its `StatusChip` (`FLAG`, `UNKNOWN`, `OK`, `SKIPPED`), `detail`, `evidence` (when non-null), and `+${check.scoreImpact} pts` (when `scoreImpact > 0`).

## Requirements

- Complies with WCAG 2.1 AA accessibility standards, semantic HTML, and responsive layout down to 390px viewport width per `docs/style-guide.md §5.2`.
- Preserves existing site color tokens in `client/src/index.css` and `client/src/styles/layout.css` (uses `'neutral'` tone for `INSUFFICIENT_DATA` and `SKIPPED`).
- Respects `prefers-reduced-motion` in both CSS and JS (`client/src/lib/motion.ts`).
- Zero new runtime dependencies in `server/package.json` or `client/package.json`.
- Client tests reside in `client/tests/SCRUM-70-T-3_evaluateFrontend.test.tsx` (mocking `fetch` offline with Vitest + React Testing Library) and backend integration tests reside in `server/tests/SCRUM-70-T-3_evaluateIntegration.test.ts` (Supertest with mocked workers), with zero live network or database calls.
- All formatting (`npm run format:check`), linting (`npm --prefix client run lint`, `npm --prefix server run lint`), builds (`npm --prefix client run build`, `npm --prefix server run build`), and test suites (`npm --prefix client test`, `npm --prefix server test`) must pass cleanly.

## Acceptance criteria

1. `POST /api/evaluate` invokes `orchestrateEvaluation` and `calculateListingScore(rawChecks)` and returns HTTP 200 `{ success: true, data: { score, rating, summary, checks, rawChecks } }` for valid `application/json` payloads.
2. `POST /api/evaluate` rejects malformed `application/json` payloads (e.g., invalid URL, negative rent, or stringified rent) with HTTP 400 `{ success: false, error: 'Validation failed', details }`.
3. `calculateListingScore` and `POST /api/evaluate` recognize `'OBFUSCATED_CONTACT'` on `contactPhone` (scoring `POINTS_OBFUSCATED_CONTACT` and preserving `evidence` when present or `'Area code: ' + areaCode` fallback), distinct from `NON_LOCAL_AREA_CODE` (`POINTS_NON_LOCAL_PHONE`).
4. Submitting the listing form via `checkListing` dispatches a `fetch` `POST` request to `${apiUrl}/api/evaluate` with `Content-Type: application/json`, the validated `ListingInput` fields (excluding `photos`), and a `10_000`ms timeout signal, and normalizes the Zod-validated response into a `ScanResult`.
5. While the evaluation request is in flight (`submitting === true`), the turning-gear loading overlay (`aria-busy="true"`, `role="status"`) is mounted and form controls (`<fieldset disabled>`), Submit, and Autofill buttons are disabled; when idle, no loading overlay is mounted.
6. When `prefers-reduced-motion: reduce` is enabled, spinning animations on the loading indicator are disabled and a calm, static loading state is displayed.
7. For `LOW`, `MEDIUM`, and `HIGH` ratings, `ResultsView` displays the rating chip, `headline.title`, and `headline.advice` on the summary card, and `"More details"` renders `scan.summary` (when present), the numeric score, progress bar, and non-expandable check rows showing each check's status (`FLAG`, `UNKNOWN`, `OK`, `SKIPPED`), `detail`, matched `evidence` (when non-null), and `scoreImpact` (when > 0).
8. For an `INSUFFICIENT_DATA` response (`score: null`), `ResultsView` renders the neutral `INSUFFICIENT DATA` chip and explanation while omitting `"More details"`, `"Share result"`, and `0 / 100` score elements from the DOM, and `App` / `scanStorage` / `ScansView` do not persist or list the scan.
9. When `POST /api/evaluate` rejects due to a network error, timeout, or non-2xx HTTP status, the UI clears the loading state, preserves entered form values, re-enables submission, and displays a friendly retry error alert (`role="alert"`).
10. Saving and restoring scored scans containing `SKIPPED` checks (`scoreImpact`, `evidence`, `rating`, `summary`) and legacy stored scans via `scanStorage` completes without Zod schema errors (backfilling missing legacy fields), and `saveScans` excludes any `score: null` (`INSUFFICIENT_DATA`) scans.

## Tests

Files: `server/tests/SCRUM-70-T-3_evaluateIntegration.test.ts` and `client/tests/SCRUM-70-T-3_evaluateFrontend.test.tsx`
Setup for all: Offline Vitest suites with mocked workers (Supertest on `app`) on the server and mocked `globalThis.fetch` + `window.matchMedia` (React Testing Library) on the client. All assertions follow `docs/style-guide.md §3.2`, prefixed with `[Criterion N]`.

- Criterion 1: `SCRUM-70-T-3 wires calculateListingScore into POST /api/evaluate for JSON payloads` — sends a valid JSON listing payload to `POST /api/evaluate` with mocked workers; asserts HTTP 200, `success: true`, and `data` contains `score`, `rating`, `summary`, `checks`, and `rawChecks`.
- Criterion 2: `SCRUM-70-T-3 rejects malformed JSON payloads with HTTP 400` — sends invalid JSON payloads (invalid URL, non-positive rent, stringified rent) to `POST /api/evaluate`; asserts HTTP 400, `success: false`, `error: 'Validation failed'`, and `details`.
- Criterion 3: `SCRUM-70-T-3 scores OBFUSCATED_CONTACT with POINTS_OBFUSCATED_CONTACT and evidence fallback` — mocks `evaluatePhoneAreaCode` returning `OBFUSCATED_CONTACT` in `POST /api/evaluate` and invokes `calculateListingScore` with `OBFUSCATED_CONTACT` payloads (with `evidence` and with `areaCode` fallback); asserts `FLAG`, `POINTS_OBFUSCATED_CONTACT`, and expected `evidence`.
- Criterion 4: `SCRUM-70-T-3 dispatches JSON POST to /api/evaluate with validated ListingInput fields` — submits `ListingForm` / calls `checkListing` with valid inputs (and an attached `File` photo); asserts `fetch` is called once at `/api/evaluate` with method `POST`, `application/json` header, JSON body containing the form fields without `photos`, an `AbortSignal`, and returns a normalized `ScanResult`.
- Criterion 5: `SCRUM-70-T-3 mounts turning-gear loading overlay and disables controls while evaluating` — asserts no loading overlay is mounted before submission (autofill `role="status"` remains unique), holds the mocked `fetch` promise pending after submission, and asserts the loading overlay (queried via `aria-busy="true"` / loading text) and gear indicator are visible while form inputs, Submit, and Autofill buttons are disabled.
- Criterion 6: `SCRUM-70-T-3 disables spinning animation under prefers-reduced-motion` — mocks `window.matchMedia('(prefers-reduced-motion: reduce)')` to return `matches: true`; asserts the loading overlay renders a static indicator without the spinning animation class.
- Criterion 7: `SCRUM-70-T-3 renders score, summary, rating chip, and check diagnostics inside More details` — renders `ResultsView` with a mocked scored `ScanResult` containing `FLAG`, `OK`, `UNKNOWN`, and `SKIPPED` checks; asserts rating chip, `headline.title`, and `headline.advice` on the summary card, and `scan.summary`, score, progress bar, check statuses, `detail`, `evidence`, and `scoreImpact` inside `"More details"` without per-item expand toggles.
- Criterion 8: `SCRUM-70-T-3 renders INSUFFICIENT DATA view without More details and does not save scan` — submits a listing through `App` returning `rating: 'INSUFFICIENT_DATA'` and `score: null`; asserts neutral `INSUFFICIENT DATA` chip and explanation are shown, `"More details"`, `"Share result"`, and `0 / 100` score elements are absent from the DOM, and the scan is not persisted in `sessionStorage` or listed in `ScansView` / `HomeView`.
- Criterion 9: `SCRUM-70-T-3 displays retry alert and restores form controls on API failure` — mocks `fetch` network rejection, timeout error, and HTTP 500 response; asserts loading overlay disappears, form field values remain intact, submit button is re-enabled, and `role="alert"` error message is displayed.
- Criterion 10: `SCRUM-70-T-3 persists scored scans with SKIPPED checks and filters out null-score scans` — saves and loads a scored scan with a `SKIPPED` check (`scoreImpact`, `evidence`, `rating`, `summary`), a legacy scan without optional fields, and an `INSUFFICIENT_DATA` (`score: null`) scan via `scanStorage`; asserts scored and legacy scans round-trip cleanly with normalized defaults while the `score: null` scan is excluded.
