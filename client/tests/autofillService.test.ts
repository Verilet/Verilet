import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAutofillListing } from '../src/services/autofillService';

const API = 'http://api.test';
const LINK = 'https://sfbay.craigslist.org/apa/d/listing/123.html';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(impl: () => Promise<Response>) {
  const fetchMock = vi.fn<typeof fetch>(impl);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const autofill = createAutofillListing({ baseUrl: API });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('autofillListing', () => {
  it('posts the link to /api/scrape and maps the scraped details onto the form fields', async () => {
    const fetchMock = stubFetch(async () =>
      jsonResponse({
        success: true,
        data: {
          title: 'Sunny room near campus',
          rent: 1250,
          address: '  123 Bay St, Santa Cruz, CA ',
          description: 'Furnished room.\nUtilities included.',
          photos: ['https://images.example.com/1.jpg'],
        },
      }),
    );

    await expect(autofill(LINK)).resolves.toEqual({
      rent: '1250',
      location: '123 Bay St, Santa Cruz, CA',
      description: 'Furnished room.\nUtilities included.',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/api/scrape`);
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual({ url: LINK });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('leaves fields blank that the scraper could not find', async () => {
    stubFetch(async () =>
      jsonResponse({
        success: true,
        data: { title: null, rent: null, address: null, description: '   ', photos: [] },
      }),
    );

    await expect(autofill(LINK)).resolves.toEqual({});
  });

  it('finds nothing when the server could not scrape the listing', async () => {
    stubFetch(async () =>
      jsonResponse({ success: false, data: null, message: 'Failed to scrape listing details' }),
    );

    await expect(autofill(LINK)).resolves.toEqual({});
  });

  it.each([
    [
      'rent is not a number',
      { success: true, data: { rent: '1250', address: null, description: null } },
    ],
    ['data is missing', { success: true }],
    ['the body is not an object', ['unexpected']],
  ])('finds nothing when the response has a bad shape (%s)', async (_name, body) => {
    stubFetch(async () => jsonResponse(body));

    await expect(autofill(LINK)).resolves.toEqual({});
  });

  it('finds nothing when the response is not JSON', async () => {
    stubFetch(
      async () => new Response('<!doctype html><title>Not the API</title>', { status: 200 }),
    );

    await expect(autofill(LINK)).resolves.toEqual({});
  });

  it('finds nothing when the server rejects the link', async () => {
    stubFetch(async () => jsonResponse({ error: 'Invalid listing URL' }, 400));

    await expect(autofill(LINK)).resolves.toEqual({});
  });

  it('finds nothing on a network error', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    await expect(autofill(LINK)).resolves.toEqual({});
  });

  it('finds nothing when the request times out', async () => {
    const fetchMock = stubFetch(() =>
      Promise.reject(new DOMException('The operation timed out.', 'TimeoutError')),
    );
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

    await expect(createAutofillListing({ baseUrl: API, timeoutMs: 1234 })(LINK)).resolves.toEqual(
      {},
    );

    expect(timeoutSpy).toHaveBeenCalledWith(1234);
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(timeoutSpy.mock.results[0].value);
    timeoutSpy.mockRestore();
  });

  it('ignores a trailing slash on the API base URL', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ success: false, data: null }));

    await createAutofillListing({ baseUrl: `${API}/` })(LINK);

    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/api/scrape`);
  });
});
