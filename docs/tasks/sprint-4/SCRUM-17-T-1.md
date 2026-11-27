---
id: SCRUM-17-T-1
story: SCRUM-17
sprint: 4
assignee: Lars Voigt-Bui
estimate_hours: 4
---

# OpenCorporates API Client, Timeout Handling, and Entity Caching

## Description

Serves SCRUM-17 (verify corporate rental agencies against California registry records). This task implements the external OpenCorporates HTTP client in server/src/services/openCorporatesClient.service.ts. It validates query inputs with Zod, enforces an explicit 5000ms timeout, manages API key authorization, provides an in-memory cache to conserve API quota, and normalizes API responses (200 with match, 200 empty, 429 rate limit, 500/timeout). Out of scope: corporate indicator regex filters, business logic status evaluation (SCRUM-17-T-2), routes, and UI

## Specs

- Input validation schema colocated in server/src/services/openCorporatesClient.service.ts:

        - OpenCorporatesQuerySchema: z.string().trim()

        - Type derived via z.infer

        - Interface OpenCorporatesCompany: { name: string, company_number: string, current_status?: string | null, jurisdiction_code: string }

- fetchCaliforniaCompany(query, options?):

        - Validates query with OpenCorporatesQuerySchema.safeParse(). If blank or invalid, returns { success: true, data: null }.

        - Normalizes query (trimmed, lowercased) and checks an in-memory cache Map. Returns cached entry if present.

        - Resolves API key from options?.apiKey or process.env.OPENCORPORATES_API_KEY. If unconfigured, returns { success: true, data: null, error: 'API_KEY_MISSING' } without making network calls.

        - Constructs URL: https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(query)}&jurisdiction_code=us_ca&api_token=${apiKey}

        - Dispatches fetch with AbortSignal.timeout(5000).

        - On HTTP 200: extracts data?.results?.companies?.[0]?.company ?? null, caches it, and returns { success: true, data: company }.

        - On HTTP 429: returns { success: false, data: null, error: 'RATE_LIMITED' }.

        - On timeout / 5xx error: returns { success: false, data: null, error: 'TIMEOUT' }.

        - Exports clearCompanyCache() to reset cache between test runs.

## Requirements

- Input validated with Zod (OpenCorporatesQuerySchema); company typed with standard TypeScript interface.

- Pure client layer; zero business scoring or scam flags.

- Unit tests in server/tests/SCRUM-17-T-1_openCorporatesClient.test.ts mock globalThis.fetch via Vitest (vi.spyOn(globalThis, 'fetch')); zero live network calls in CI.

- Enforces explicit 5000ms timeout per docs/architecture.md.

## Acceptance Criteria

- A successful 200 response with matching company data returns { success: true, data: company }.

- A successful 200 response with an empty companies list returns { success: true, data: null }.

- Duplicate calls for the same normalized name return the cached result and only trigger fetch once.

- Requests taking longer than 5000ms abort cleanly and return { success: false, error: 'TIMEOUT' }.

- HTTP 429 rate limit responses return { success: false, error: 'RATE_LIMITED' }.

- Missing OPENCORPORATES_API_KEY returns { success: true, data: null, error: 'API_KEY_MISSING' } without dispatching an HTTP request.

- Invalid or blank query strings return { success: true, data: null } without calling fetch.

- All tests pass 100% offline using mocked responses.

## Tests

- Criterion 1: SCRUM-17-T-1 returns { success: true, data: company } when given a name that the mocked 200 response matches, such as "Pacific Coast Rentals LLC". It asserts data has name, company_number, jurisdiction_code and current_status exactly as in the first results.companies[0].company entry, and asserts fetch was called exactly once. It evaluates a company whose current_status is null or missing and asserts it is still returned as-is.

- Criterion 2: SCRUM-17-T-1 returns { success: true, data: null } when given a name for which the mocked 200 response has an empty companies list. It evaluates a body where results or companies is missing entirely and asserts the same result, so the optional chaining never throws.

- Criterion 3: SCRUM-17-T-1 returns { success: true, data: null } without calling fetch when given an invalid or blank query. It evaluates "", " ", 69, undefined, null, and {}, asserts each returns { success: true, data: null }, and asserts fetch was called 0 times.

- Criterion 4: SCRUM-17-T-1 returns the cached result on duplicate normalized queries. It evaluates "Bay Area Student Housing Group", then " bay area STUDENT housing group ", and asserts identical results with fetch called once. It asserts a different name triggers a second fetch, and that a cached empty result (data: null) is also served from cache. It asserts that calling clearCompanyCache() and repeating the same lookup triggers fetch again, for 2 calls total.

- Criterion 5: SCRUM-17-T-1 returns { success: true, data: null, error: 'API_KEY_MISSING' } without calling fetch when no key is configured. It evaluates with process.env.OPENCORPORATES_API_KEY unset and no options.apiKey, and with an empty-string env key, and asserts fetch was called 0 times each. It evaluates with both options.apiKey and the env var set, and asserts the request URL contains the options key. It evaluates with only the env var set, and asserts the URL contains the env key.

- Criterion 6: SCRUM-17-T-1 dispatches the request as specified. It asserts the URL starts with https://api.opencorporates.com/v0.4/companies/search, contains jurisdiction_code=us_ca and api_token=, and has the query URL-encoded (e.g., "Smith & Sons Realty" becomes Smith%20%26%20Sons%20Realty). It asserts the fetch init includes an AbortSignal, and that AbortSignal.timeout was called with 5000.

- Criterion 7: SCRUM-17-T-1 returns { success: false, data: null, error: 'RATE_LIMITED' } when the mocked response is HTTP 429. It asserts the result is not cached: a follow-up call for the same name after a mocked 200 triggers a second fetch and returns the company.

- Criterion 8: SCRUM-17-T-1 returns { success: false, data: null, error: 'TIMEOUT' } for timeouts and server errors. It evaluates a mocked fetch rejecting with a TimeoutError (and with an AbortError), a mocked HTTP 500, and a mocked HTTP 503, and asserts 'TIMEOUT' each time. It asserts none of these throw, and that none are cached. It asserts the whole suite runs with globalThis.fetch mocked via vi.spyOn and the cache cleared in beforeEach, so no live network call happens.
