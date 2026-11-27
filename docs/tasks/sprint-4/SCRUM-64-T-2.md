---
id: SCRUM-64-T-2
story: SCRUM-64
sprint: 4
assignee: Yifei Peng
estimate_hours: 6
---

# Compare listing copies and flag rent or contact mismatches

## Description

Serves SCRUM-64. Rental scammers copy a real listing's photos and address, repost it on Craigslist with a lower rent, and put their own contact information on it. SCRUM-64-T-1 finds up to 5 copies of the listing on other sites. This task scrapes those copies with Firecrawl, compares their rent and contact information with the listing being checked, and sets the `status`, `flag`, and `message` fields that the scoring engine (SCRUM-70-T-2) already reads. Copies are weighted by how trustworthy their source is: copies with an MLS number are trusted first, then large listing sites, and open sites where anyone can post (for example Facebook Marketplace) are never used as the reference. Out of scope: connecting this check to the evaluation orchestrator, adding photos or a contact email to the evaluate request, detecting copies that are for sale or sold as a separate fraud signal, and the results screen.

## Specs

- Service: `server/src/services/listingCompare.service.ts`, exporting three functions:
  - `scrapeListingCopy(url)`: scrapes one copy and returns `Promise<ScrapedCopy | null>` (`null` if the scrape failed).
  - `compareListingCopies(listing, search, copies)`: a pure function (no network calls) that returns a `ListingSearchResult` with `status`, `flag`, and `message` set.
  - `checkListingCopies(listing, search)`: scrapes every URL in `search.matches` in parallel with `Promise.allSettled`, then calls `compareListingCopies`. It never throws for scrape failures.
- Input: `ListingComparisonInputSchema` (Zod): `{ rent: number (positive, finite), bedrooms: BedroomValue (from evaluate.schema.ts), phone?: string | null, email?: string | null (valid email if present) }`. Invalid input throws a `ZodError` before any network call. `search` is the `ListingSearchResult` returned by `findListingCopies` (SCRUM-64-T-1).
- `ScrapedCopy`: `{ url, trust, rentMin, rentMax, bedrooms, phone, email, mlsNumber, listingType }`:
  - `rentMin` / `rentMax`: numbers or `null`. A single rent has `rentMin === rentMax`; a building with several units has a range.
  - `bedrooms`: a `BedroomValue` or `null`.
  - `listingType`: `'for_rent' | 'for_sale' | 'sold' | 'off_market' | 'unknown'`.
  - `trust`: computed by this service, not scraped:
    - `'mls'` if `mlsNumber` is a non-empty string;
    - otherwise `'portal'` if the host is in `TRUSTED_PORTALS` (subdomains count);
    - otherwise `'open'`.
- Constants at the top of the file:
  - `RENT_GAP_THRESHOLD = 0.15`: the listing is flagged when its rent is at least 15% below the reference rent.
  - `SCRAPE_TIMEOUT_MS = 15000`: the timeout for each scrape.
  - `TRUSTED_PORTALS`: `realtor.com`, `redfin.com`, `zillow.com`, `trulia.com`, `apartments.com`, `zumper.com`, `hotpads.com`, `rent.com`.
  - `FREE_EMAIL_DOMAINS`: `gmail.com`, `yahoo.com`, `outlook.com`, `hotmail.com`, `icloud.com`, `aol.com`, `proton.me`, `protonmail.com`.
- Scraping:
  - Calls `POST https://api.firecrawl.dev/v2/scrape` with header `Authorization: Bearer <FIRECRAWL_API_KEY>` and body `{ url, formats: [{ type: 'json', schema, prompt }] }`.
  - The schema asks for rent (or a min and max rent), bedrooms, phone, email, MLS number, and listing type.
  - Reads `data.json` and validates it with a Zod schema.
  - A scrape fails (returns `null`) on a network error, a non-2xx status, a timeout after `SCRAPE_TIMEOUT_MS`, a missing API key, or a response that does not match the schema.
  - The timeout uses an `AbortController` aborted by `setTimeout`, as in SCRUM-64-T-1.
- Normalizing:
  - Phones are compared as their last 10 digits after removing every non-digit (so `(831) 555-0100`, `831.555.0100`, and `+1 831 555 0100` are equal). A phone with fewer than 10 digits counts as missing.
  - Emails are compared trimmed and lowercased. The domain is the part after `@`.
- Comparable copies: a scraped copy is comparable only if all of these hold:
  - its `listingType` is `'for_rent'` or `'unknown'`;
  - its `bedrooms` equals the listing's `bedrooms`, or is `null`;
  - it has a rent, a phone, or an email.
- Reference copies: the comparable copies of the highest trust tier that has any (`'mls'` first, then `'portal'`). `'open'` copies are never reference copies.
- Price check:
  - Each reference copy's rent is its `rentMin`.
  - The reference rent is the median of the reference copies' rents. Copies without a rent are ignored here.
  - Price mismatch if `listing.rent <= referenceRent * (1 - RENT_GAP_THRESHOLD)`.
  - A higher listing rent is never a mismatch.
  - With no reference rent, there is no price verdict.
- Contact check (phone first, then email):
  1. **Phone:** if the listing has a phone and at least one reference copy has a phone, it is a contact mismatch when the listing's phone equals none of the reference copies' phones.
  2. **Email:** otherwise, if the listing has an email and at least one reference copy has an email, it is a contact mismatch when, for every reference copy with an email, both of these hold:
     - the emails differ;
     - the domains differ, or the shared domain is in `FREE_EMAIL_DOMAINS`.
  3. **Neither:** otherwise, there is no contact verdict.
- Result. The outcome is decided in this order, and returns `{ status, flag, message, matches, failedSources }`. `matches` and `failedSources` are copied from `search`, and each match gets `rent` set to its scraped `rentMin` (or `null`).
  1. `search.matches` is empty and `search.failedSources` is not empty: `skipped`, with a message that the copy search failed.
  2. `search.matches` is empty: `skipped`, with a message that no copies were found on other sites.
  3. There are no reference copies, because every scrape failed, only open copies were found, or no copy was comparable: `skipped`, with a message that the copies could not be verified.
  4. There is a price mismatch or a contact mismatch: `violation` with flag `DUPLICATE_LISTING_MISMATCH`, and a message naming each mismatch found (rent, phone, or email) and the reference value.
  5. Otherwise: `compliant` with `flag: null`.
- `skipped` and `compliant` results always have `flag: null`.

## Requirements

- Depends on SCRUM-64-T-1 (`findListingCopies`, `ListingMatch`, `ListingSearchResult`) being merged into `main` first.
- Service lives in `server/src/services/listingCompare.service.ts`. Input, scraped data, and the Firecrawl response use Zod schemas, with types from `z.infer`.
- Use the built-in `fetch` and the existing `FIRECRAWL_API_KEY`. No new runtime dependencies and no new environment variables.
- Tests mock `fetch` with `vi.stubGlobal`, so they make no real network calls and need no API key. `compareListingCopies` is tested directly with hand-built `ScrapedCopy` objects.
- No route, orchestrator, scoring engine, database, or frontend changes in this task.
- All task tests pass, existing tests still pass, and lint and the type check are clean.

## Acceptance criteria

1. When the listing's rent is at least 15% below the reference rent, the result is `violation` with flag `DUPLICATE_LISTING_MISMATCH`. A gap of exactly 15% is flagged, a gap of 14% is not, and a listing rent higher than the reference is never flagged.
2. Copies with an MLS number are the reference when present; otherwise trusted listing sites are the reference; open-site copies are never the reference, even when their rent is lower than the listing's.
3. The reference rent is the median of the reference copies' rents, using the lowest rent of a range, and copies with a different bedroom count or a `for_sale`, `sold`, or `off_market` type are left out of the comparison.
4. When the listing and the reference copies have phones, a listing phone that matches none of them is a contact mismatch (`violation`), and the same phone written in a different format is not a mismatch.
5. When the listing or the reference copies have no phone, emails are compared instead: a different address on a different domain or on a free email domain is a mismatch, and a different address on the same company domain is not.
6. When the reference copies agree with the listing's rent and contact, or no contact can be compared and the rent agrees, the result is `compliant` with `flag: null`.
7. The result is `skipped` with `flag: null` and a reason-specific message when no copies were found, when the copy search failed, when only open-site copies were found, or when no copy is comparable.
8. `checkListingCopies` scrapes every match with Firecrawl JSON extraction in parallel; a scrape that fails, times out after 15 seconds, or returns malformed data is left out without stopping the others, and the function does not throw.
9. Input with a non-positive rent, an unknown bedroom value, or an invalid email is rejected with a `ZodError` and makes no network call.

## Tests

File: `server/tests/SCRUM-64-T-2_listingCompare.test.ts`

Setup for all: Offline Vitest unit tests grouped under `describe('SCRUM-64-T-2: listing copy comparison', ...)`. `compareListingCopies` is called with hand-built `ScrapedCopy` objects. For `checkListingCopies`, `fetch` is replaced with `vi.stubGlobal('fetch', ...)` returning canned Firecrawl scrape JSON, and `FIRECRAWL_API_KEY` is set with `vi.stubEnv`. Test names follow `docs/style-guide.md` §3.2 with a `[Criterion N]` prefix.

- Criterion 1: `[Criterion 1] flags a listing whose rent is at least 15% below the reference rent`: one portal reference copy at $2000; a listing at $1700 (exactly 15%) is `violation` with `DUPLICATE_LISTING_MISMATCH` and a message mentioning rent; $1720 (14%) and $2400 (higher) are `compliant`.
- Criterion 2: `[Criterion 2] uses MLS copies first and never uses open-site copies as the reference`: an MLS copy at $2000 and a portal copy at $1700 with a listing at $1700 is `violation` (MLS wins); a listing at $1700 with only a Facebook Marketplace copy at $1700 and no trusted copy is `skipped`; an open copy at $1500 alongside a portal copy at $1750 does not change a `compliant` result for a listing at $1700.
- Criterion 3: `[Criterion 3] compares against the median rent of comparable reference copies`: portal copies at $1900, $2000, and $3000 give a reference of $2000; a copy with range $2000-$3500 counts as $2000; a 2-bedroom copy and a `for_sale` copy at $900000 are ignored for a 1-bedroom listing.
- Criterion 4: `[Criterion 4] flags a listing phone that matches no reference copy`: listing `831-555-0100` with reference phones `(831) 555-0199` is `violation` with a message mentioning phone; listing `+1 831.555.0199` with reference `(831) 555-0199` is `compliant`.
- Criterion 5: `[Criterion 5] compares email when phones are not available`: no listing phone; listing `scam@gmail.com` vs reference `leasing@riverrow.com` is `violation`; listing `john@riverrow.com` vs reference `leasing@riverrow.com` is `compliant`; listing `a@gmail.com` vs reference `b@gmail.com` is `violation`.
- Criterion 6: `[Criterion 6] returns compliant when the reference copies agree with the listing`: same rent and same phone is `compliant` with `flag: null`; same rent with no phone or email on either side is `compliant`.
- Criterion 7: `[Criterion 7] skips with a reason when copies cannot be compared`: empty matches with `failedSources: ['address']`, empty matches with no failed sources, only open copies, and only 2-bedroom copies for a 1-bedroom listing each return `skipped`, `flag: null`, and a different non-empty message.
- Criterion 8: `[Criterion 8] scrapes every match in parallel and tolerates failed scrapes`: three matches where the first returns 500, the second never resolves until aborted (fake timers advanced 15000 ms), and the third returns a valid portal copy; asserts three POST calls to the scrape URL, each body has `formats[0].type === 'json'`, the result is computed from the third copy only, and the promise resolves. With `FIRECRAWL_API_KEY` unset, the result is `skipped` and nothing throws.
- Criterion 9: `[Criterion 9] rejects invalid listing input before any network call`: `rent: 0`, `rent: -100`, `bedrooms: '7'`, and `email: 'not-an-email'` each reject with a `ZodError`, and `fetch` is never called.
