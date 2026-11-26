/**
 * Cross-platform duplicate listing search service.
 * Serves SCRUM-64 (find copies of a listing on other rental sites).
 */

import { z } from 'zod';

/** Maximum number of listing copies returned. */
export const MAX_MATCHES = 5;

/** Maximum number of listing photos sent to Google Cloud Vision. */
export const MAX_PHOTOS = 5;

/** Timeout for each outside API call, in milliseconds. */
export const SEARCH_TIMEOUT_MS = 5000;

/**
 * Sites never returned as a listing copy. Subdomains count (e.g. sfbay.craigslist.org).
 * Craigslist is blocked because it is the source being checked; the others host images,
 * not rental listings. Every other site is kept.
 */
export const BLOCKED_SITES: readonly string[] = [
  'craigslist.org',
  'pinterest.com',
  'pinterest.ca',
  'pinterest.co.uk',
  'pinterest.com.au',
  'imgur.com',
  'flickr.com',
  'photobucket.com',
  'imgbb.com',
  'ibb.co',
  'postimg.cc',
  'shutterstock.com',
  'istockphoto.com',
  'gettyimages.com',
  'alamy.com',
  'dreamstime.com',
  'depositphotos.com',
  '123rf.com',
  'unsplash.com',
  'stock.adobe.com',
];

/** Firecrawl web search endpoint. */
const FIRECRAWL_SEARCH_URL = 'https://api.firecrawl.dev/v2/search';

/** Number of results requested from Firecrawl before filtering. */
const FIRECRAWL_RESULT_LIMIT = 10;

/** Google Cloud Vision image annotation endpoint. */
const VISION_ANNOTATE_URL = 'https://vision.googleapis.com/v1/images:annotate';

/** Facebook path prefix that counts as a rental listing; other Facebook pages are dropped. */
const FACEBOOK_MARKETPLACE_PATH = '/marketplace';

/** A web URL using the http or https protocol. */
const httpUrl = () => z.url({ protocol: /^https?$/ });

/** Input for findListingCopies. Needs an address, at least one photo, or both. */
export const ListingSearchInputSchema = z
  .object({
    /** Listing address; an empty or whitespace-only address counts as missing. */
    address: z
      .string()
      .trim()
      .nullish()
      .transform((address) => (address ? address : null)),
    /** Listing photo URLs. */
    photos: z.array(httpUrl()).default([]),
    /** The listing's own URL, never returned as a match. */
    excludeUrl: httpUrl().nullish(),
  })
  .refine((input) => input.address !== null || input.photos.length > 0, {
    message: 'An address or at least one photo is required',
    path: ['address'],
  });

/** Input accepted by findListingCopies (photos may be omitted). */
export type ListingSearchInput = z.input<typeof ListingSearchInputSchema>;

/** Search source that found a listing. */
export type SearchSource = 'address' | 'photo';

/** A copy of the listing found on another site. */
export interface ListingMatch {
  readonly url: string;
  /** The page's hostname without a leading "www." (e.g. "zillow.com"). */
  readonly site: string;
  readonly title: string | null;
  readonly matchedBy: readonly SearchSource[];
}

/** Result of findListingCopies. */
export interface ListingSearchResult {
  readonly matches: readonly ListingMatch[];
  readonly failedSources: readonly SearchSource[];
}

/** Firecrawl search response; individual results are validated separately. */
const FirecrawlResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    web: z.array(z.unknown()).optional(),
  }),
});

/** A single Firecrawl web result. */
const FirecrawlResultSchema = z.object({
  url: z.string(),
  title: z.string().nullish(),
});

/** Google Cloud Vision response; individual pages are validated separately. */
const VisionResponseSchema = z.object({
  responses: z.array(
    z.object({
      webDetection: z
        .object({
          pagesWithMatchingImages: z.array(z.unknown()).optional(),
        })
        .optional(),
    }),
  ),
});

/** A single Vision page that contains a matching image. */
const VisionPageSchema = z.object({
  url: z.string(),
  pageTitle: z.string().nullish(),
});

/** A search result before filtering. */
interface SearchHit {
  readonly url: string;
  readonly title: string | null;
}

/** A match being collected; matchedBy can grow when both searches find it. */
interface CollectedMatch {
  readonly url: string;
  readonly site: string;
  readonly title: string | null;
  readonly matchedBy: SearchSource[];
}

/**
 * Normalizes a URL for comparison by removing the query string, hash, and trailing slash.
 *
 * @param rawUrl URL to normalize.
 * @return The normalized URL, or null if it is not a valid URL.
 */
function normalizeUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

/**
 * Checks whether a hostname is a domain or a subdomain of it.
 *
 * @param host Lowercase hostname.
 * @param domain Domain to compare against.
 * @return True if host is domain or ends with ".domain".
 */
function isOnDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * Returns the site name for a URL, or null if the URL should be dropped: not an http(s)
 * URL, on a blocked site, or a Facebook page outside Marketplace.
 *
 * @param rawUrl URL of a search result.
 * @return The hostname without a leading "www.", or null.
 */
function siteFor(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_SITES.some((domain) => isOnDomain(host, domain))) {
    return null;
  }
  if (isOnDomain(host, 'facebook.com') && !url.pathname.startsWith(FACEBOOK_MARKETPLACE_PATH)) {
    return null;
  }
  return host.replace(/^www\./, '');
}

/**
 * Removes HTML tags (Vision page titles can contain <b> tags) and blank titles.
 *
 * @param title Raw title from a search API.
 * @return The cleaned title, or null if it is empty.
 */
function cleanTitle(title: string | null | undefined): string | null {
  const cleaned = title?.replace(/<[^>]*>/g, '').trim();
  return cleaned ? cleaned : null;
}

/**
 * Sends a JSON POST request with a timeout and returns the parsed JSON body.
 * Throws on network errors, timeouts, and non-2xx responses.
 *
 * @param url Endpoint URL.
 * @param headers Request headers, including authentication.
 * @param body JSON request body.
 * @return The parsed response body.
 */
async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  // A setTimeout-based abort (rather than AbortSignal.timeout) so tests can use fake timers.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Search API responded with status ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Searches the web for the address with Firecrawl.
 *
 * @param address Listing address.
 * @return Search hits in the order returned, or null if the search failed.
 */
async function searchByAddress(address: string): Promise<SearchHit[] | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  try {
    const json = await postJson(
      FIRECRAWL_SEARCH_URL,
      { Authorization: `Bearer ${apiKey}` },
      {
        query: `"${address.replace(/"/g, '')}" rent`,
        limit: FIRECRAWL_RESULT_LIMIT,
        excludeDomains: BLOCKED_SITES,
      },
    );
    const parsed = FirecrawlResponseSchema.safeParse(json);
    if (!parsed.success) {
      return null;
    }
    const hits: SearchHit[] = [];
    for (const item of parsed.data.data.web ?? []) {
      const result = FirecrawlResultSchema.safeParse(item);
      if (result.success) {
        hits.push({ url: result.data.url, title: cleanTitle(result.data.title) });
      }
    }
    return hits;
  } catch {
    return null;
  }
}

/**
 * Runs a reverse image search on the photos with Google Cloud Vision web detection.
 *
 * @param photos Photo URLs; at most MAX_PHOTOS are sent.
 * @return Pages containing matching images, or null if the search failed.
 */
async function searchByPhotos(photos: readonly string[]): Promise<SearchHit[] | null> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  try {
    const json = await postJson(
      VISION_ANNOTATE_URL,
      { 'X-Goog-Api-Key': apiKey },
      {
        requests: photos.slice(0, MAX_PHOTOS).map((imageUri) => ({
          image: { source: { imageUri } },
          features: [{ type: 'WEB_DETECTION' }],
        })),
      },
    );
    const parsed = VisionResponseSchema.safeParse(json);
    if (!parsed.success) {
      return null;
    }
    const hits: SearchHit[] = [];
    for (const imageResponse of parsed.data.responses) {
      for (const item of imageResponse.webDetection?.pagesWithMatchingImages ?? []) {
        const page = VisionPageSchema.safeParse(item);
        if (page.success) {
          hits.push({ url: page.data.url, title: cleanTitle(page.data.pageTitle) });
        }
      }
    }
    return hits;
  } catch {
    return null;
  }
}

/**
 * Finds up to MAX_MATCHES copies of a listing on sites other than Craigslist and image hosts.
 * Searches by address with Firecrawl first, and only runs the Google Cloud Vision
 * photo search when the address search found fewer than MAX_MATCHES copies.
 *
 * @param input Listing address, photo URLs, and the listing's own URL.
 * @return Up to MAX_MATCHES matches and the searches that failed.
 * @throws ZodError if the input is invalid.
 */
export async function findListingCopies(input: ListingSearchInput): Promise<ListingSearchResult> {
  const { address, photos, excludeUrl } = ListingSearchInputSchema.parse(input);
  const excludeKey = excludeUrl ? normalizeUrl(excludeUrl) : null;

  // Map keeps insertion order, so address matches stay ahead of photo matches.
  const collected = new Map<string, CollectedMatch>();
  const failedSources: SearchSource[] = [];

  const addHits = (hits: readonly SearchHit[], source: SearchSource): void => {
    for (const hit of hits) {
      const site = siteFor(hit.url);
      const key = normalizeUrl(hit.url);
      if (!site || !key || key === excludeKey) {
        continue;
      }
      const existing = collected.get(key);
      if (existing) {
        if (!existing.matchedBy.includes(source)) {
          existing.matchedBy.push(source);
        }
      } else if (collected.size < MAX_MATCHES) {
        collected.set(key, { url: hit.url, site, title: hit.title, matchedBy: [source] });
      }
    }
  };

  if (address) {
    const addressHits = await searchByAddress(address);
    if (addressHits) {
      addHits(addressHits, 'address');
    } else {
      failedSources.push('address');
    }
  }

  if (photos.length > 0 && collected.size < MAX_MATCHES) {
    const photoHits = await searchByPhotos(photos);
    if (photoHits) {
      addHits(photoHits, 'photo');
    } else {
      failedSources.push('photo');
    }
  }

  return {
    matches: [...collected.values()].map((match) => ({
      ...match,
      matchedBy: [...match.matchedBy],
    })),
    failedSources,
  };
}

/**
 * Placeholder called by the evaluation orchestrator until SCRUM-64 is connected to it.
 * Connecting findListingCopies to the orchestrator is out of scope for SCRUM-64-T-1.
 *
 * @param input Evaluation request (unused).
 * @return An empty search result.
 */
export async function listingSearch(input?: unknown): Promise<ListingSearchResult> {
  void input;
  return {
    matches: [],
    failedSources: [],
  };
}
