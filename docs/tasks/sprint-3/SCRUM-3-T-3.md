---
id: SCRUM-3-T-3
story: SCRUM-3
sprint: 3
assignee: Aubrey Hayes
estimate_hours: 5
---

# Connect listing form autofill to POST /api/scrape

## Description

Serves SCRUM-3 (paste a listing link to extract property details). This task connects the listing link input and autofill workflow in the listing form to the backend scrape endpoint (`POST /api/scrape`) via `autofillService.ts` and populates extracted details ready for student review.

Out of scope: the backend scraper implementation (`SCRUM-3-T-1`, `SCRUM-3-T-2`), remote photo downloading (photos remain user-uploaded file attachments), and risk assessment scanners (`SCRUM-18` through `SCRUM-21`).

## Specs

- **Validation:** In `ListingForm` (`client/src/components/ListingForm.tsx`), client-side validation checks the listing link before dispatching. If the input is empty, contains only whitespace, is not a valid URL, or uses an unsupported protocol (e.g. `ftp://`, `javascript:`, `file:`), an inline validation error is shown, the link input is focused, and no request is sent.
- **In-flight State:** While the request runs, the autofill button text displays "Reading…" and is disabled to prevent duplicate submissions or race conditions.
- **Service Request:** A valid URL sends exactly one `POST ${VITE_API_URL}/api/scrape` with JSON body `{ "url": "<listing_url>" }`, `Content-Type: application/json`, and an explicit 10,000ms timeout (`AbortSignal.timeout(10000)`). If `VITE_API_URL` is undefined or empty, it falls back to relative `/api/scrape`.
- **Response Parsing:** Normalizes the backend envelope `{ success: boolean, data: { title: string | null, rent: number | null, address: string | null, description: string | null, photos: string[] } | null, message?: string }`.
- **Form Population:**
  - `rent`: Populated into Monthly Rent as a string (e.g., `2500` -> `"2500"`).
  - `address`: Populated into City or address.
  - `description`: Populated into Description & Messages, combining `title` and `description` separated by a double newline (`\n\n`) when both exist. If only one exists, that single value is used.
- **Preservation & Editability:** Populated fields remain fully editable by the user. Existing field values already typed by the user are strictly preserved and never overwritten by autofill. Missing or null scrape fields stay blank.
- **Status Messaging:**
  - On success with at least one extracted field: Displays the inline banner `"Details filled. Please review below."`.
  - When the scrape finds no fields or the server reports an unreadable listing (`success: false`): Displays `"Couldn't read link. Please enter details below."`.
  - On network failure, request timeout (10s), or server error (HTTP 4xx/5xx): Displays `"Server error. Please try again."`.
- **Fault Tolerance:** Failed, timed-out, or empty scrapes never crash the page or wipe existing form inputs.

## Requirements

- Built with React 19 and TypeScript, using `import.meta.env.VITE_API_URL` for the backend address with safe empty string fallback. No hard-coded hostnames.
- Network logic, timeout, and envelope parsing encapsulated inside `client/src/services/autofillService.ts`.
- Uses existing `ListingForm` from `client/src/components/ListingForm.tsx`.
- All automated unit and component tests placed in `client/tests/SCRUM-3-T-3_autofill.test.tsx` using Vitest and React Testing Library with mocked `fetch` and fixture responses. Zero live external network calls.
- No new runtime dependencies.

## Acceptance criteria

1. An empty, invalid, or non-HTTP/HTTPS URL shows an inline alert, focuses the input, and sends no network request.
2. A valid URL sends exactly one POST to /api/scrape with `{ "url": "<url>" }` and a 10-second timeout.
3. During the request, the button text is "Reading…" and the button is disabled.
4. A successful response populates rent, location, and title + description, and displays "Details filled. Please review below."
5. Autofilled fields can be edited by the user, and fields already typed by the user before autofill are not overwritten.
6. An empty or unreadable scrape displays "Couldn't read link. Please enter details below.", while a network, timeout, or server failure displays "Server error. Please try again.", and neither crashes the page.

## Tests

File: `client/tests/SCRUM-3-T-3_autofill.test.tsx`
Setup for all: Render `ListingForm` wrapped with Vitest mock `fetch` handlers and fixture responses.

- Criterion 1: `SCRUM-3-T-3 [Criterion 1] rejects invalid or non-HTTP URL, focuses input, and sends no request` — enters empty string and `ftp://example.com`, asserts error alert is rendered, input is focused, and `globalThis.fetch` is not called.
- Criterion 2: `SCRUM-3-T-3 [Criterion 2] sends single POST to /api/scrape with url and 10s timeout signal` — enters valid URL, clicks Autofill, asserts `fetch` called once with `POST`, headers, payload `{ "url": "<url>" }`, and timeout signal.
- Criterion 3: `SCRUM-3-T-3 [Criterion 3] sets button text to Reading… and disables button while request is in flight` — delays fetch resolution, asserts button text is "Reading…" and button has disabled attribute.
- Criterion 4: `SCRUM-3-T-3 [Criterion 4] populates rent, location, combined description, and shows success banner` — mocks 200 OK scrape result, asserts rent, location, combined title + description populated, and banner text is "Details filled. Please review below."
- Criterion 5: `SCRUM-3-T-3 [Criterion 5] preserves user-typed inputs and keeps autofilled fields editable` — pre-fills rent, clicks Autofill, asserts user rent is preserved while other fields populate, then modifies populated location.
- Criterion 6: `SCRUM-3-T-3 [Criterion 6] displays appropriate banner on unreadable scrape or server/timeout error without crashing` — mocks `{ success: false }` -> asserts "Couldn't read link. Please enter details below."; mocks network rejection / 500 error / timeout -> asserts "Server error. Please try again." without crashing.
