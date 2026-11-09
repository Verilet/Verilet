---
id: SCRUM-3-T-1
story: SCRUM-3
sprint: 2
assignee: Aubrey Hayes
estimate_hours: 4
---

# Extract listing metadata and Schema.org JSON-LD via POST /api/scrape

## Description

Serves SCRUM-3 (paste a listing link to extract property details). This task implements the backend `POST /api/scrape` endpoint with URL validation, HTTP request timeout handling, structured data parsing from `Schema.org` JSON-LD (`<script type="application/ld+json">`), and fallback metadata extraction from OpenGraph tags (`og:title`, `og:description`, `og:image`).

## Specs

- `POST /api/scrape` accepts a JSON request body `{ "url": "<url_string>" }`.
- When `url` is missing, not a string, or not a valid HTTP/HTTPS URL (e.g. `not-a-url`, `ftp://example.com`), the endpoint returns HTTP 400 with `{ "error": "Invalid listing URL" }`.
- When target HTML contains `<script type="application/ld+json">` with housing or product schemas, the endpoint extracts available fields and returns HTTP 200 with:
  `{ "success": true, "data": { "title": string, "rent": number | null, "address": string | null, "description": string | null, "photos": string[] } }`.
- When target HTML lacks JSON-LD but contains OpenGraph meta tags, the endpoint extracts `og:title`, `og:description`, and `og:image` and returns HTTP 200 with:
  `{ "success": true, "data": { "title": string, "rent": null, "address": null, "description": string, "photos": string[] } }`.
- When external network requests exceed 5000ms or return HTTP 4xx/5xx error codes, the endpoint catches the error and returns HTTP 200 with `{ "success": false, "data": null, "message": "Failed to scrape listing details" }` without crashing the server.

## Requirements

- Endpoint must be registered on the existing Express/backend server in `server/src/routes/` and mounted under `/api`.
- Outgoing HTTP client requests must specify an explicit 5000ms timeout.
- Unit tests must be placed in `server/tests/` and run offline using local HTML mock fixtures without live external network calls.
- No database schema migrations or frontend code modifications in this task.

## Acceptance criteria

1. A missing, empty, or non-HTTP/HTTPS `url` in the request body is rejected with HTTP 400 and error message "Invalid listing URL".
2. HTML containing Schema.org JSON-LD returns HTTP 200 with extracted title, rent, address, description, and photos.
3. HTML lacking JSON-LD but containing OpenGraph tags returns HTTP 200 with title, description, and photos populated from `og:*` tags (rent and address set to null).
4. An external request that times out or returns an HTTP error code (403, 404, 500) returns HTTP 200 with `{ "success": false, "data": null, "message": "Failed to scrape listing details" }`.
5. The server process does not terminate, throw unhandled promise rejections, or fail subsequent requests after a failed or timed-out scrape.

## Tests

File: `server/tests/SCRUM-3-T-1_scrape.test.ts`
Setup for all: Start supertest app instance with mocked external HTTP fetch responses using local HTML fixtures.

- Criterion 1: `SCRUM-3-T-1 rejects non-HTTP or empty URL with 400` — sends `{ "url": "ftp://bad" }` and `{ "url": "" }`, asserts HTTP 400 and error message "Invalid listing URL".
- Criterion 2: `SCRUM-3-T-1 extracts Schema.org JSON-LD property details` — mocks response with Apartment JSON-LD fixture, asserts HTTP 200 and extracted fields match fixture data.
- Criterion 3: `SCRUM-3-T-1 falls back to OpenGraph meta tags when JSON-LD is absent` — mocks response with `og:title`, `og:description`, and `og:image`, asserts HTTP 200 with extracted fields and null rent/address.
- Criterion 4: `SCRUM-3-T-1 catches timeouts and HTTP error codes gracefully` — mocks a 5000ms timeout and a 403 Forbidden, asserts HTTP 200 with `{ "success": false }` payload and error message.
- Criterion 5: `SCRUM-3-T-1 server remains healthy and serves requests after failed scrape` — sends a failed scrape followed by a valid scrape, asserts the second request succeeds with HTTP 200.
