---
id: SCRUM-64-T-1
story: SCRUM-64
sprint: 4
assignee: Yifei Peng
estimate_hours: 6
---

# Find up to 5 other listings of the same rental by address and photo

## Description

Serves SCRUM-64. Rental scammers often copy a real listing's photos and address and repost it on another site. This task finds up to 5 copies of a listing on any site except Craigslist, Pinterest, and image hosts. It searches the web for the listing's address with Firecrawl first. To save cost, it only runs a reverse image search with Google Cloud Vision when the address search finds fewer than 5 copies. If both searches together still find fewer than 5, it returns as many as it found. The result is a list of links that SCRUM-64-T-2 will scrape and compare. Out of scope: scraping the found pages and comparing their rent and contact information (SCRUM-64-T-2), adding this worker to the evaluation orchestrator, and the results screen.

## Specs

- `findListingCopies(input)` in `server/src/services/listingSearch.service.ts` returns `Promise<{ matches: ListingMatch[], failedSources: ('address' | 'photo')[] }>`.
- `ListingSearchInputSchema` (Zod): `{ address?: string | null (trimmed; an empty or whitespace-only address counts as missing), photos: string[] (each a URL, default []), excludeUrl?: string (URL) }`. The input must have an address, at least one photo, or both; if it has neither, it is invalid. Invalid input throws a `ZodError`.
- Each match is `{ url, site, title, matchedBy }`:
  - `site` is the page's hostname without a leading `www.` (e.g. `'zillow.com'`).
  - `title` is the page title from the search result, or `null`.
  - `matchedBy` is `['address']`, `['photo']`, or `['address', 'photo']`.
- Constants at the top of the file:
  - `MAX_MATCHES = 5`: the most matches returned.
  - `MAX_PHOTOS = 5`: the most photos sent to Vision.
  - `SEARCH_TIMEOUT_MS = 5000`: the timeout for each outside call.
  - `BLOCKED_SITES`: hostnames that are never returned: `craigslist.org`, Pinterest (`pinterest.com`, `.ca`, `.co.uk`, `.com.au`), and image and stock-photo hosts (`imgur.com`, `flickr.com`, `photobucket.com`, `imgbb.com`, `ibb.co`, `postimg.cc`, `shutterstock.com`, `istockphoto.com`, `gettyimages.com`, `alamy.com`, `dreamstime.com`, `depositphotos.com`, `123rf.com`, `unsplash.com`, `stock.adobe.com`). Subdomains count (e.g. `sfbay.craigslist.org`). Every other site is kept, except that `facebook.com` pages are kept only under `/marketplace`.
- Address search:
  - Calls Firecrawl Search: `POST https://api.firecrawl.dev/v2/search` with header `Authorization: Bearer <FIRECRAWL_API_KEY>` and body `{ query: '"<address>" rent', limit: 10, excludeDomains: BLOCKED_SITES }`.
  - Reads `data.web[].url` and `data.web[].title`, in the order returned.
- Photo search:
  - Calls Google Cloud Vision `images:annotate` with `WEB_DETECTION` and the key `GOOGLE_VISION_API_KEY`, for at most the first `MAX_PHOTOS` photos, in one request.
  - Reads `webDetection.pagesWithMatchingImages[].url` and `.pageTitle`.
- Which searches run, in order:
  1. If the input has an address, the address search runs first.
  2. The photo search runs only if the input has photos **and** fewer than `MAX_MATCHES` matches were found so far, including when the address search failed or was skipped.
  3. If the address search already found `MAX_MATCHES` matches, Vision is not called.
- Filtering and merging, applied to every result before it is counted:
  - Results on a `BLOCKED_SITES` host, non-Marketplace Facebook pages, and non-http(s) URLs are dropped. This also runs on Firecrawl results, because Firecrawl's `excludeDomains` is not guaranteed to cover subdomains.
  - URLs are compared after removing the query string, the hash, and a trailing slash.
  - A result whose normalized URL equals the normalized `excludeUrl` is dropped.
  - A photo result whose URL was already found by the address search is not added again; that match's `matchedBy` becomes `['address', 'photo']`.
- Matches are returned in the order found (address results first, then photo results), cut to the first `MAX_MATCHES`. Fewer than `MAX_MATCHES` matches, including none, is a normal result.
- Every outside call is cancelled after `SEARCH_TIMEOUT_MS` using an `AbortController` aborted by `setTimeout` (not `AbortSignal.timeout`, which Vitest fake timers cannot advance).
- If a search fails (network error, non-2xx status, timeout, missing API key, or a response that does not match its Zod schema), that source is added to `failedSources`. The function does not throw for these failures.
- A search that does not run (no address, no photos, or `MAX_MATCHES` already reached) makes no API call and is not added to `failedSources`.
- Individual results that don't match the expected shape (e.g. missing `url`) are skipped.

## Requirements

- Service lives in `server/src/services/listingSearch.service.ts`. Input, output, and API response schemas use Zod, with types from `z.infer`.
- `FIRECRAWL_API_KEY` and `GOOGLE_VISION_API_KEY` are added to `server/.env.example` with no real values. Real keys are never committed.
- Use the built-in `fetch` for both APIs. No new runtime dependencies (no Firecrawl SDK).
- Tests mock `fetch`, so they make no real network calls and need no API keys.
- No routes, database changes, orchestrator changes, or frontend changes in this task.
- Worst-case run time is about 10 seconds (two calls in a row). The orchestrator's 5-second worker timeout must be raised for this worker when it is connected (separate task).
- All task tests pass, existing tests still pass, and lint and the type check are clean.

## Acceptance criteria

1. An address that appears on a site that is not blocked returns that listing in `matches` with its URL, site name, title, and `matchedBy: ['address']`.
2. When the address search finds 5 or more qualifying listings, the first 5 are returned and the photo search is not run.
3. When the address search finds fewer than 5, the photo search runs on at most the first 5 photos and adds its matches until there are 5. A listing found by both searches appears once with `matchedBy: ['address', 'photo']`.
4. When both searches together find fewer than 5 listings, all of them are returned (0 to 4) without an error.
5. Craigslist, Pinterest, image-host, and non-Marketplace Facebook results are never returned from either search; results from any other site, including unknown sites, are kept.
6. The listing's own URL (`excludeUrl`) is never returned, even with a different query string or trailing slash.
7. An address-only listing runs only the address search, a photo-only listing runs only the photo search, and input with no address and no photos, or a photo that isn't a URL, is rejected.
8. If a search fails or takes longer than 5 seconds, it is named in `failedSources`, the other search still runs when allowed, and the function does not throw.

## Tests

File: `server/tests/SCRUM-64-T-1_listingSearch.test.ts`

Setup for all: Offline Vitest unit tests. `fetch` is replaced with `vi.stubGlobal('fetch', ...)` returning canned Firecrawl and Vision JSON, and both API keys are set with `vi.stubEnv`. Test names follow `docs/style-guide.md` §3.2 with a `[Criterion N]` prefix.

- Criterion 1: `[Criterion 1] returns a listing found by address search`: Firecrawl returns one `zillow.com` result and the input has no photos; asserts one match with that URL, `site: 'zillow.com'`, its title, `matchedBy: ['address']`, and `failedSources: []`. Also asserts the Firecrawl request used the `"<address>" rent` query, sent `excludeDomains: BLOCKED_SITES`, and sent no `includeDomains`.
- Criterion 2: `[Criterion 2] skips the photo search when the address search finds 5 listings`: Firecrawl returns 6 qualifying results and the input has photos; asserts exactly the first 5 are returned in order and Vision's URL was never called.
- Criterion 3: `[Criterion 3] fills up to 5 matches with the photo search`: Firecrawl returns 2 qualifying results; Vision returns 5 pages, one of them the same `zillow.com` URL as an address result but with a query string. Asserts Vision was called once with exactly the first 5 of 6 input photos, 5 matches are returned, and the shared URL appears once with `matchedBy: ['address', 'photo']`.
- Criterion 4: `[Criterion 4] returns fewer than 5 matches when that is all it finds`: case 1: Firecrawl returns 1 and Vision returns 1 different result; asserts 2 matches. Case 2: both return nothing; asserts `matches: []` and `failedSources: []`. Neither case throws.
- Criterion 5: two tests. `[Criterion 5] drops Craigslist, Pinterest, image hosts, and non-Marketplace Facebook pages from both searches`: Firecrawl returns `sfbay.craigslist.org`, `pinterest.com`, a Facebook group, and a `trulia.com` result; Vision returns `i.imgur.com`, `pinterest.ca`, `shutterstock.com`, `stock.adobe.com`, and a local property-manager site; asserts only the Trulia and property-manager results are returned. `[Criterion 5] keeps sites that are not blocked`: a Facebook Marketplace page, a blog, and an unknown property-manager site are all returned with their hostnames as `site`.
- Criterion 6: `[Criterion 6] never returns the listing being checked`: both searches return the `excludeUrl` with an added query string and trailing slash, plus one other rental listing; asserts only the other listing is returned.
- Criterion 7: `[Criterion 7] runs only the searches the input supports`: an address with `photos: []` calls only Firecrawl; no address with one photo calls only Vision; `address: '   '` with one photo is treated as photo-only. Each asserts `failedSources: []`. Invalid cases (no address and `photos: []`, `address: null` with no photos, and a valid address with `photos: ['not-a-url']`) each reject with a `ZodError` and `fetch` is never called.
- Criterion 8: `[Criterion 8] reports a failed search and still runs the other`: case 1: Firecrawl responds 500 and Vision returns a match; asserts the photo match and `failedSources: ['address']`. Case 2: Firecrawl returns 1 result and Vision's `fetch` waits on its abort signal, with fake timers advanced 5000 ms; asserts the address match and `failedSources: ['photo']`. Case 3: `FIRECRAWL_API_KEY` is unset; asserts `'address'` is in `failedSources` and Vision still runs. No case throws.
