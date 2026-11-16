---
id: SCRUM-64-T-1
story: SCRUM-64
sprint: 4
assignee: Yifei Peng
estimate_hours: 6
---

# Find other listings of the same rental by address and photo

## Description

Serves SCRUM-64. Rental scammers often copy a real listing's photos and address and repost it on another site. This task finds copies of a listing: it searches the web for the listing's address and runs a reverse image search on its photos, then returns the matching listings it finds on known rental sites (Craigslist, Zillow, Apartments.com, Facebook Marketplace, and others in the site list). For Craigslist matches it also returns the rent, using the existing `scrapeListing`. Out of scope: comparing the copies and flagging fraud, new scrapers for sites other than Craigslist, the HTTP endpoint that calls checkers, and the results screen.

## Specs

- `findListingCopies(input)` in `server/src/services/listingSearch.service.ts` returns `Promise<{ matches: ListingMatch[], failedSources: ('address' | 'photo')[] }>`.
- `ListingSearchInputSchema` (Zod): `{ address: string (non-empty after trim), photos: string[] (each a URL, default []), excludeUrl?: string (URL) }`. Invalid input throws a `ZodError`.
- Each match is `{ url, site, title, matchedBy, rent }`:
  - `site` is the rental site name from the site list (e.g. `'craigslist'`, `'zillow'`).
  - `title` is the page title from the search result, or `null`.
  - `matchedBy` is `['address']`, `['photo']`, or `['address', 'photo']`.
  - `rent` is a number for Craigslist matches whose rent was scraped, otherwise `null`.
- Known rental sites are kept in one `RENTAL_SITES` constant at the top of the file, mapping a hostname to a site name: `craigslist.org`, `zillow.com`, `apartments.com`, `facebook.com` (only `/marketplace` paths), `trulia.com`, `hotpads.com`, `rent.com`, `zumper.com`. Subdomains count (e.g. `sfbay.craigslist.org`). Any other host is dropped.
- Address search calls SerpApi Google Search (`https://serpapi.com/search.json`) with the query `"<address>" rent` and the key `SERPAPI_API_KEY`. It reads `organic_results[].link` and `organic_results[].title`.
- Photo search calls Google Cloud Vision `images:annotate` with `WEB_DETECTION` and the key `GOOGLE_VISION_API_KEY`, for at most the first 5 photos. It reads `webDetection.pagesWithMatchingImages[].url` and `.pageTitle`.
- Results are merged by URL. URLs are compared after removing the query string, the hash, and a trailing slash. A URL found by both searches appears once with `matchedBy: ['address', 'photo']`.
- A result whose normalized URL equals the normalized `excludeUrl` is never returned.
- For each Craigslist match, `scrapeListing(url)` is called and `data.rent` is used. If scraping fails, `rent` is `null`.
- Every outside call (SerpApi, Vision, and each scrape) is cancelled after 5 seconds with `AbortSignal.timeout(5000)`.
- If a search API fails (network error, non-2xx status, timeout, missing API key, or a response that does not match its Zod schema), that source is added to `failedSources` and the other source's matches are still returned. The function does not throw for these failures.
- Individual results that don't match the expected shape (e.g. missing `link`) are skipped.

## Requirements

- Service lives in `server/src/services/listingSearch.service.ts`. Input, output, and API response schemas use Zod, with types from `z.infer`.
- `SERPAPI_API_KEY` and `GOOGLE_VISION_API_KEY` are added to `server/.env.example` with no real values. Real keys are never committed.
- Use the built-in `fetch`. No new runtime dependencies.
- Tests mock `fetch` and `scrapeListing`, so they make no real network calls and need no API keys.
- No routes, database changes, or frontend changes in this task.
- All task tests pass, existing tests still pass, and lint and the type check are clean.

## Acceptance criteria

1. An address that appears on another rental site returns that listing in `matches` with `matchedBy: ['address']`.
2. A photo that appears on another rental site returns that listing with `matchedBy: ['photo']`, and only the first 5 photos are searched.
3. A listing found by both address and photo appears once, with `matchedBy: ['address', 'photo']`.
4. Results from sites that aren't rental sites (news, blogs, image hosts) are not included.
5. The listing's own URL (`excludeUrl`) is never returned as a match, even with a different query string or trailing slash.
6. A Craigslist match includes its rent; matches from other sites, and Craigslist matches that fail to scrape, have `rent: null`.
7. If one search API fails or takes longer than 5 seconds, the other's matches are still returned, and the failed one is named in `failedSources`.
8. Invalid input (missing address, a photo that isn't a URL) is rejected.

## Tests

File: `server/tests/SCRUM-64-T-1_listingSearch.test.ts`

Setup for all: Offline Vitest unit tests. `fetch` is replaced with `vi.stubGlobal('fetch', ...)` returning canned SerpApi and Vision JSON, `scrapeListing` is mocked with `vi.mock`, and both API keys are set with `vi.stubEnv`.

- Criterion 1: `SCRUM-64-T-1 returns a rental-site listing found by address search` — SerpApi returns a `zillow.com` result and Vision returns no pages; asserts one match with that URL, `site: 'zillow'`, its title, `matchedBy: ['address']`, and `failedSources: []`.
- Criterion 2: `SCRUM-64-T-1 returns a rental-site listing found by photo search` — SerpApi returns no results and Vision returns an `apartments.com` page; asserts one match with `matchedBy: ['photo']`. With 6 photos in the input, asserts Vision was called for exactly the first 5.
- Criterion 3: `SCRUM-64-T-1 merges a listing found by both address and photo` — both APIs return the same `zillow.com` URL, one with a query string; asserts one match with `matchedBy: ['address', 'photo']`.
- Criterion 4: `SCRUM-64-T-1 drops results that are not on rental sites` — results from a news site, a blog, `imgur.com`, and a non-Marketplace `facebook.com` page plus one `trulia.com` result; asserts only the Trulia result is returned.
- Criterion 5: `SCRUM-64-T-1 never returns the listing being checked` — both APIs return the `excludeUrl` with an added query string and trailing slash plus one other rental listing; asserts only the other listing is returned.
- Criterion 6: `SCRUM-64-T-1 adds rent to Craigslist matches only` — matches on `sfbay.craigslist.org` (scrape returns rent 1800), `zillow.com`, and a second Craigslist URL whose scrape fails; asserts rent 1800, `null`, and `null`, and that `scrapeListing` was not called for the Zillow URL.
- Criterion 7: `SCRUM-64-T-1 returns the other source when one search fails or times out` — case 1: SerpApi responds 500 and Vision returns a match; asserts the photo match and `failedSources: ['address']`. Case 2: Vision's `fetch` waits on its abort signal, using fake timers advanced 5000 ms; asserts the address match and `failedSources: ['photo']`. Neither case throws.
- Criterion 8: `SCRUM-64-T-1 rejects invalid input` — missing `address`, `address: '   '`, and `photos: ['not-a-url']`; asserts each call rejects with a `ZodError` and `fetch` was never called.
