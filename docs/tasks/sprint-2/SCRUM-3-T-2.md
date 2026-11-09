---
id: SCRUM-3-T-2
story: SCRUM-3
sprint: 2
assignee: Aubrey Hayes
estimate_hours: 6
---

# Dedicated Craigslist Cheerio scraper and domain router

## Description

Serves SCRUM-3 (paste a listing link to extract property details). This task builds part of the scraping pipeline: a domain routing mechanism that inspects the incoming listing URL and routes Craigslist links (`craigslist.org`) to a dedicated Cheerio DOM extractor. The extractor targets platform-specific HTML selectors for rent (`.price`), space details (`.housing`), title, and description, while falling back to Schema.org JSON-LD and OpenGraph when fields are missing or for non-Craigslist domains.

## Specs

- The scraping pipeline inspects the hostname of the input URL:
  - If the hostname matches `craigslist.org` or ends with `.craigslist.org`, it executes the dedicated Craigslist Cheerio extractor before falling back to generic metadata.
  - If the hostname does not match Craigslist, it passes directly to the generic extraction engine.
- The dedicated Craigslist Cheerio extractor parses:
  - `rent`: Extracted from `.price`, `.postingtitletext .price`, or `.price-tag`. Numeric string is sanitized (removing `$`, commas, and whitespace) and parsed as a number.
  - `title`: Extracted from `#titletextonly` or `h1.postingtitle`.
  - `address`: Extracted from `.mapaddress` or `.postingtitletext small` (falls back to Schema.org if absent).
  - `description`: Extracted from `#postingbody`, stripping out boilerplate disclaimers (e.g. "QR Code Link to This Post").
  - `photos`: Extracted from `#thumbs a[href]` or `img[src]` thumbnails, resolved as absolute URLs.
- If any individual field cannot be extracted from the dedicated DOM selectors, the pipeline falls back to Schema.org JSON-LD or OpenGraph to fill in missing fields without throwing errors.
- The response returns the standardized envelope:
  `{ "success": true, "data": { "title": string, "rent": number | null, "address": string | null, "description": string | null, "photos": string[] } }`.
- Timeouts (5000ms) and HTTP error codes (403, 404, 500) continue to return `{ "success": false, "data": null, "message": "Failed to scrape listing details" }` with HTTP 200 without crashing the server.

## Requirements

- Dedicated Craigslist extractor and domain router must be placed in `server/src/services/`.
- All unit tests must be located in `server/tests/SCRUM-3-T-2_craigslist.test.ts` and use offline mock HTML fixtures with zero live network calls.
- Must integrate with the existing `POST /api/scrape` endpoint without breaking any existing `SCRUM-3-T-1` tests.
- No frontend code or database schema migrations in this task.

## Acceptance criteria

1. A Craigslist HTML fixture with a `.price` tag (e.g. `$2,800`) returns the numeric rent (`2800`).
2. A Craigslist HTML fixture with `#titletextonly` and `#postingbody` extracts the listing title and description without boilerplate disclaimers.
3. A Craigslist HTML fixture with `#thumbs` extracts image URLs into the `photos` array.
4. A Craigslist HTML fixture missing custom DOM selectors seamlessly falls back to Schema.org JSON-LD or OpenGraph metadata without error.
5. A URL on an unsupported domain (e.g. Zillow or generic page) bypasses the dedicated Craigslist parser and successfully extracts metadata via the generic fallback pipeline.

## Tests

File: `server/tests/SCRUM-3-T-2_craigslist.test.ts`
Setup for all: Start supertest app instance with mocked external HTTP fetch responses using local HTML fixtures.

- Criterion 1: `SCRUM-3-T-2 extracts numeric rent from Craigslist .price selector` — mocks response with Craigslist HTML containing `<span class="price">$2,800</span>`, asserts HTTP 200 and `rent: 2800`.
- Criterion 2: `SCRUM-3-T-2 extracts title and clean description from Craigslist DOM` — mocks response with `#titletextonly` and `#postingbody`, asserts clean text without "QR Code Link".
- Criterion 3: `SCRUM-3-T-2 extracts gallery photos from Craigslist #thumbs` — mocks response with `#thumbs` image anchors, asserts `photos` array is populated with resolved URLs.
- Criterion 4: `SCRUM-3-T-2 falls back to Schema.org and OpenGraph when Craigslist DOM lacks selectors` — mocks response with minimal Craigslist HTML containing only JSON-LD, asserts fields are populated from fallback.
- Criterion 5: `SCRUM-3-T-2 delegates non-Craigslist domains to generic fallback pipeline` — sends non-Craigslist URL, asserts generic JSON-LD/OpenGraph extraction succeeds.
