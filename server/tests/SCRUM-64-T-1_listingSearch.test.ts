import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import {
  BLOCKED_SITES,
  findListingCopies,
  MAX_MATCHES,
  SEARCH_TIMEOUT_MS,
} from '../src/services/listingSearch.service.js';

const FIRECRAWL_URL = 'https://api.firecrawl.dev/v2/search';
const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate';

const ADDRESS = '123 Ocean St, Santa Cruz, CA 95060';
const PHOTO = (n: number) => `https://images.craigslist.org/photo${n}_600x450.jpg`;

/** A Firecrawl result item. */
const web = (url: string, title = `Title for ${url}`) => ({ url, title, description: '' });
/** A Vision page item. */
const page = (url: string, pageTitle = `Page for ${url}`) => ({ url, pageTitle });

const firecrawlBody = (results: unknown[]) => ({ success: true, data: { web: results } });
const visionBody = (pages: unknown[]) => ({
  responses: [{ webDetection: { pagesWithMatchingImages: pages } }],
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

type Handler = (init: RequestInit) => Promise<Response> | Response;

/** Installs a fetch mock that routes Firecrawl and Vision calls to the given handlers. */
function mockFetch(handlers: { firecrawl?: Handler; vision?: Handler }) {
  const fetchMock = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    if (url.startsWith(FIRECRAWL_URL) && handlers.firecrawl) {
      return handlers.firecrawl(init);
    }
    if (url.startsWith(VISION_URL) && handlers.vision) {
      return handlers.vision(init);
    }
    throw new Error(`Unexpected fetch to ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const callsTo = (fetchMock: ReturnType<typeof mockFetch>, prefix: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url).startsWith(prefix));

const bodyOf = (call: unknown[]) => JSON.parse(String((call[1] as RequestInit).body));

/** A fetch handler that never resolves until its abort signal fires. */
const hangUntilAborted: Handler = (init) =>
  new Promise<Response>((_, reject) => {
    init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  });

beforeEach(() => {
  vi.stubEnv('FIRECRAWL_API_KEY', 'test-firecrawl-key');
  vi.stubEnv('GOOGLE_VISION_API_KEY', 'test-vision-key');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('SCRUM-64-T-1: findListingCopies address and photo search', () => {
  it('[Criterion 1] returns a listing found by address search with matchedBy address', async () => {
    const zillow = 'https://www.zillow.com/homedetails/123-Ocean-St/1_zpid/';
    const fetchMock = mockFetch({
      firecrawl: () => jsonResponse(firecrawlBody([web(zillow, '123 Ocean St | Zillow')])),
    });

    const result = await findListingCopies({ address: ADDRESS, photos: [] });

    expect(result).toEqual({
      matches: [
        {
          url: zillow,
          site: 'zillow.com',
          title: '123 Ocean St | Zillow',
          matchedBy: ['address'],
        },
      ],
      failedSources: [],
    });
    const [firecrawlCall] = callsTo(fetchMock, FIRECRAWL_URL);
    expect((firecrawlCall[1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer test-firecrawl-key',
    });
    const body = bodyOf(firecrawlCall);
    expect(body).toMatchObject({ query: `"${ADDRESS}" rent`, excludeDomains: BLOCKED_SITES });
    expect(body).not.toHaveProperty('includeDomains');
  });

  it('[Criterion 2] returns the first 5 address matches and does not call Vision when the address search finds 5', async () => {
    const urls = Array.from({ length: 6 }, (_, i) => `https://www.zumper.com/apartments/${i}`);
    const fetchMock = mockFetch({
      firecrawl: () => jsonResponse(firecrawlBody(urls.map((url) => web(url)))),
      vision: () => jsonResponse(visionBody([])),
    });

    const result = await findListingCopies({ address: ADDRESS, photos: [PHOTO(1)] });

    expect(result.matches.map((match) => match.url)).toEqual(urls.slice(0, MAX_MATCHES));
    expect(result.failedSources).toEqual([]);
    expect(callsTo(fetchMock, VISION_URL)).toHaveLength(0);
  });

  it('[Criterion 3] fills up to 5 matches with the photo search and merges a listing found by both', async () => {
    const shared = 'https://www.zillow.com/homedetails/shared/2_zpid';
    const trulia = 'https://www.trulia.com/home/123-ocean';
    const photoOnly = [1, 2, 3, 4].map((i) => `https://hotpads.com/listing/${i}`);
    const photos = [1, 2, 3, 4, 5, 6].map(PHOTO);
    const fetchMock = mockFetch({
      firecrawl: () => jsonResponse(firecrawlBody([web(shared), web(trulia)])),
      vision: () =>
        jsonResponse(
          visionBody([page(`${shared}?utm_source=img`), ...photoOnly.map((url) => page(url))]),
        ),
    });

    const result = await findListingCopies({ address: ADDRESS, photos });

    const visionCalls = callsTo(fetchMock, VISION_URL);
    expect(visionCalls).toHaveLength(1);
    const sentUris = bodyOf(visionCalls[0]).requests.map(
      (request: { image: { source: { imageUri: string } } }) => request.image.source.imageUri,
    );
    expect(sentUris).toEqual(photos.slice(0, 5));
    expect(result.matches).toHaveLength(MAX_MATCHES);
    expect(result.matches.filter((match) => match.url.includes('/shared/'))).toEqual([
      expect.objectContaining({ url: shared, matchedBy: ['address', 'photo'] }),
    ]);
    expect(result.matches.map((match) => match.url)).toEqual([
      shared,
      trulia,
      ...photoOnly.slice(0, 3),
    ]);
  });

  it('[Criterion 4] returns fewer than 5 matches without an error when that is all the searches find', async () => {
    mockFetch({
      firecrawl: () => jsonResponse(firecrawlBody([web('https://www.rent.com/california/a')])),
      vision: () => jsonResponse(visionBody([page('https://www.apartments.com/b/')])),
    });
    const two = await findListingCopies({ address: ADDRESS, photos: [PHOTO(1)] });
    expect(two.matches.map((match) => match.matchedBy)).toEqual([['address'], ['photo']]);
    expect(two.failedSources).toEqual([]);

    mockFetch({
      firecrawl: () => jsonResponse(firecrawlBody([])),
      vision: () => jsonResponse(visionBody([])),
    });
    const none = await findListingCopies({ address: ADDRESS, photos: [PHOTO(1)] });
    expect(none).toEqual({ matches: [], failedSources: [] });
  });

  it('[Criterion 5] drops Craigslist, Pinterest, image hosts, and non-Marketplace Facebook pages from both searches', async () => {
    const trulia = 'https://www.trulia.com/home/keep-me';
    const local = 'https://www.oceanviewpropertymgmt.com/rentals/123-ocean';
    mockFetch({
      firecrawl: () =>
        jsonResponse(
          firecrawlBody([
            web('https://sfbay.craigslist.org/apa/d/santa-cruz/123.html'),
            web('https://www.pinterest.com/pin/123/'),
            web('https://www.facebook.com/groups/santacruzhousing/posts/1'),
            web(trulia),
          ]),
        ),
      vision: () =>
        jsonResponse(
          visionBody([
            page('https://i.imgur.com/abc'),
            page('https://www.pinterest.ca/pin/456/'),
            page('https://www.shutterstock.com/image-photo/house-123'),
            page('https://stock.adobe.com/images/house/789'),
            page(local),
          ]),
        ),
    });

    const result = await findListingCopies({ address: ADDRESS, photos: [PHOTO(1)] });

    expect(result.matches.map((match) => match.url)).toEqual([trulia, local]);
  });

  it('[Criterion 5] keeps sites that are not blocked, including unknown sites and Facebook Marketplace', async () => {
    const marketplace = 'https://www.facebook.com/marketplace/item/123456/';
    const blog = 'https://someblog.wordpress.com/ocean-st-for-rent';
    const local = 'https://oceanviewpropertymgmt.com/rentals/123-ocean';
    mockFetch({
      firecrawl: () => jsonResponse(firecrawlBody([web(marketplace), web(blog), web(local)])),
    });

    const result = await findListingCopies({ address: ADDRESS });

    expect(result.matches.map((match) => [match.url, match.site])).toEqual([
      [marketplace, 'facebook.com'],
      [blog, 'someblog.wordpress.com'],
      [local, 'oceanviewpropertymgmt.com'],
    ]);
  });

  it('[Criterion 6] never returns the listing being checked, even with a query string or trailing slash', async () => {
    const own = 'https://www.zillow.com/homedetails/own-listing/9_zpid';
    const other = 'https://www.zumper.com/apartment-rentals/other';
    mockFetch({
      firecrawl: () => jsonResponse(firecrawlBody([web(`${own}/?ref=search`), web(other)])),
      vision: () => jsonResponse(visionBody([page(`${own}#photos`)])),
    });

    const result = await findListingCopies({
      address: ADDRESS,
      photos: [PHOTO(1)],
      excludeUrl: own,
    });

    expect(result.matches.map((match) => match.url)).toEqual([other]);
  });

  it('[Criterion 7] runs only the address search for an address-only listing', async () => {
    const fetchMock = mockFetch({ firecrawl: () => jsonResponse(firecrawlBody([])) });

    const result = await findListingCopies({ address: ADDRESS, photos: [] });

    expect(callsTo(fetchMock, FIRECRAWL_URL)).toHaveLength(1);
    expect(callsTo(fetchMock, VISION_URL)).toHaveLength(0);
    expect(result.failedSources).toEqual([]);
  });

  it.each([
    ['no address', { photos: [PHOTO(1)] }],
    ['a whitespace-only address', { address: '   ', photos: [PHOTO(1)] }],
  ])('[Criterion 7] runs only the photo search for a listing with %s', async (_label, input) => {
    const fetchMock = mockFetch({ vision: () => jsonResponse(visionBody([])) });

    const result = await findListingCopies(input);

    expect(callsTo(fetchMock, FIRECRAWL_URL)).toHaveLength(0);
    expect(callsTo(fetchMock, VISION_URL)).toHaveLength(1);
    expect(result.failedSources).toEqual([]);
  });

  it.each([
    ['no address and no photos', { photos: [] }],
    ['a whitespace-only address and no photos', { address: '   ', photos: [] }],
    ['a null address and photos omitted', { address: null }],
    ['a photo that is not a URL', { address: ADDRESS, photos: ['not-a-url'] }],
    ['a non-http photo URL', { address: ADDRESS, photos: ['ftp://example.com/a.jpg'] }],
  ])(
    '[Criterion 7] rejects input with %s with a ZodError and makes no API call',
    async (_label, input) => {
      const fetchMock = mockFetch({});

      await expect(findListingCopies(input)).rejects.toBeInstanceOf(ZodError);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('[Criterion 8] reports a failed address search and still returns photo matches', async () => {
    const apartments = 'https://www.apartments.com/ocean-st/xyz/';
    mockFetch({
      firecrawl: () => jsonResponse({ error: 'boom' }, 500),
      vision: () => jsonResponse(visionBody([page(apartments)])),
    });

    const result = await findListingCopies({ address: ADDRESS, photos: [PHOTO(1)] });

    expect(result.matches).toEqual([
      expect.objectContaining({ url: apartments, matchedBy: ['photo'] }),
    ]);
    expect(result.failedSources).toEqual(['address']);
  });

  it('[Criterion 8] reports a photo search that times out after 5 seconds and keeps address matches', async () => {
    vi.useFakeTimers();
    const zillow = 'https://www.zillow.com/homedetails/a/1_zpid';
    mockFetch({
      firecrawl: () => jsonResponse(firecrawlBody([web(zillow)])),
      vision: hangUntilAborted,
    });

    const pending = findListingCopies({ address: ADDRESS, photos: [PHOTO(1)] });
    await vi.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS);
    const result = await pending;

    expect(result.matches).toEqual([
      expect.objectContaining({ url: zillow, matchedBy: ['address'] }),
    ]);
    expect(result.failedSources).toEqual(['photo']);
  });

  it('[Criterion 8] reports a missing Firecrawl API key and still runs the photo search', async () => {
    vi.stubEnv('FIRECRAWL_API_KEY', '');
    const fetchMock = mockFetch({ vision: () => jsonResponse(visionBody([])) });

    const result = await findListingCopies({ address: ADDRESS, photos: [PHOTO(1)] });

    expect(result.failedSources).toEqual(['address']);
    expect(callsTo(fetchMock, FIRECRAWL_URL)).toHaveLength(0);
    expect(callsTo(fetchMock, VISION_URL)).toHaveLength(1);
  });

  it('[Criterion 8] treats a response with an unexpected shape as a failed search', async () => {
    mockFetch({ firecrawl: () => jsonResponse({ unexpected: true }) });

    const result = await findListingCopies({ address: ADDRESS });

    expect(result).toEqual({ matches: [], failedSources: ['address'] });
  });

  it('skips individual results that are missing a URL and strips HTML from Vision titles', async () => {
    const zumper = 'https://www.zumper.com/apartment-rentals/1';
    mockFetch({
      vision: () =>
        jsonResponse(
          visionBody([{ pageTitle: 'no url' }, page(zumper, '<b>Ocean</b> St rentals')]),
        ),
    });

    const result = await findListingCopies({ photos: [PHOTO(1)] });

    expect(result.matches).toEqual([
      { url: zumper, site: 'zumper.com', title: 'Ocean St rentals', matchedBy: ['photo'] },
    ]);
  });
});
