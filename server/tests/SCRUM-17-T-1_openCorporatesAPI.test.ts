import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  clearCompanyCache,
  fetchCaliforniaCompany,
} from '../src/services/openCorporatesClient.service.js';

const fakeCompanyRecord = {
  name: 'IRVINE BAY-AREA RENTALS LLC',
  company_number: 'C2271809',
  current_status: 'Active',
  jurisdiction_code: 'us_ca',
};

const buildJSONBody = (record: unknown) => ({
  results: { companies: record ? [{ company: record }] : [] },
});

const buildJsonRes = async (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status });

let mockFetch: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  clearCompanyCache();
  vi.stubEnv('OPENCORPORATES_API_KEY', 'fake-api-key-789');
  mockFetch = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(() => Promise.reject(new Error('A fetch was called without a mock')));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('[Criterion 1] Sample Test for successful 200 response: Matching CompanyData Test', () => {
  it('returns the first company record and fetch is called once', async () => {
    mockFetch.mockImplementation(() => buildJsonRes(buildJSONBody(fakeCompanyRecord)));
    const testResult = await fetchCaliforniaCompany('IRVINE BAY-AREA RENTALS LLC');
    expect(testResult).toEqual({ success: true, data: fakeCompanyRecord });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns the company as-is when current_status field is null', async () => {
    const nullCompanyRecord = { ...fakeCompanyRecord, current_status: null };
    mockFetch.mockImplementation(() => buildJsonRes(buildJSONBody(nullCompanyRecord)));
    expect((await fetchCaliforniaCompany('non-sense llc')).data).toEqual(nullCompanyRecord);
  });
});

describe('[Criterion 2] Sample Test for successful 200 response: Empty Company Data Test', () => {
  it.each([[{}], [buildJSONBody(null)], [{ results: {} }]])(
    'null is returned for %j',
    async (payload) => {
      mockFetch.mockImplementation(() => buildJsonRes(payload));
      const testResult = await fetchCaliforniaCompany('Netnobody LLC');
      expect(testResult).toEqual({ success: true, data: null });
    },
  );
});

describe('[Criterion 3] Sample Test for invalid or blank query', () => {
  it.each(['', '   ', 69, undefined, null, {}])('Fetch is skipped for %j', async (query) => {
    const testResult = await fetchCaliforniaCompany(query as never);
    expect(testResult).toEqual({ success: true, data: null });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('[Criterion 4] Sample Test for duplicate calls for same name', () => {
  it('Normalized duplicates from the cache are served', async () => {
    mockFetch.mockImplementation(() => buildJsonRes(buildJSONBody(fakeCompanyRecord)));
    const resultA = await fetchCaliforniaCompany('IRVINE BAY-AREA RENTALS LLC');
    const resultB = await fetchCaliforniaCompany('irvine bay-area RENTALS llc');
    expect(resultB).toEqual(resultA);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('Empty results are cached, different names are fetched, refetches after clear', async () => {
    mockFetch.mockImplementation(() => buildJsonRes(buildJSONBody(null)));

    await fetchCaliforniaCompany('irvine bay-area RENTALS llc');
    await fetchCaliforniaCompany('irvine bay-area RENTALS llc');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await fetchCaliforniaCompany('MiyagiDo Housing Inc');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    clearCompanyCache();
    await fetchCaliforniaCompany('irvine bay-area RENTALS llc');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

describe('[Criterion 5] Sample Test for Missing API Key', () => {
  it.each([undefined, ''])(
    'Without fetching, API_KEY_MISSING is returned for env=%j',
    async (val) => {
      vi.stubEnv('OPENCORPORATES_API_KEY', val as string);
      expect(await fetchCaliforniaCompany('IRVINE BAY-AREA RENTALS LLC')).toEqual({
        success: true,
        data: null,
        error: 'API_KEY_MISSING',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );

  it('options.apiKey is preferred over env variable', async () => {
    mockFetch.mockImplementation(() => buildJsonRes(buildJSONBody(null)));
    await fetchCaliforniaCompany('IRVINE BAY-AREA RENTALS LLC', { apiKey: 'fake-api-key' });
    const url = new URL(String(mockFetch.mock.calls[0][0]));
    expect(url.searchParams.get('api_token')).toEqual('fake-api-key');
  });

  it('env key is used when options.apiKey is not given', async () => {
    mockFetch.mockImplementation(() => buildJsonRes(buildJSONBody(null)));
    await fetchCaliforniaCompany('IRVINE BAY-AREA RENTALS LLC');
    const url = new URL(String(mockFetch.mock.calls[0][0]));
    expect(url.searchParams.get('api_token')).toEqual('fake-api-key-789');
  });
});

describe('[Criterion 6] Sample Test for Exact Request Construction', () => {
  it('URL is built and a 5000ms signal is passed', async () => {
    const timeOut = vi.spyOn(AbortSignal, 'timeout');
    mockFetch.mockImplementation(() => buildJsonRes(buildJSONBody(null)));
    await fetchCaliforniaCompany('Cruz & Tustin Realty');
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('q=Cruz%20%26%20Tustin%20Realty');
    const parsedURL = new URL(String(url));
    expect(parsedURL.origin + parsedURL.pathname).toBe(
      'https://api.opencorporates.com/v0.4/companies/search',
    );
    expect(parsedURL.searchParams.get('jurisdiction_code')).toBe('us_ca');
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
    expect(timeOut).toHaveBeenCalledWith(5000);
  });
});

describe('[Criterion 7] Sample Test for HTTP 429 Rate Limit', () => {
  it('RATE_LIMITED is returned and is not cached', async () => {
    mockFetch.mockImplementation(() => buildJsonRes({}, 429));
    const testResult = await fetchCaliforniaCompany('IRVINE BAY-AREA RENTALS LLC');
    expect(testResult).toEqual({ success: false, data: null, error: 'RATE_LIMITED' });
    mockFetch.mockImplementation(() => buildJsonRes(buildJSONBody(fakeCompanyRecord)));
    const testResult2 = (await fetchCaliforniaCompany('IRVINE BAY-AREA RENTALS LLC')).data;
    expect(testResult2).toEqual(fakeCompanyRecord);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('[Criterion 8] Sample Test for Timeout and 5xx Error Handling', () => {
  it.each([
    ['HTTP 500', () => buildJsonRes({}, 500)],
    ['HTTP 503', () => buildJsonRes({}, 503)],
    ['network timeout', () => Promise.reject(new Error('Network has timed out.'))],
  ])(
    'Without throwing or caching, TIMEOUT is returned for %s',
    async (_errorType, mockBehavior) => {
      mockFetch.mockImplementation(mockBehavior as never);
      const testResult = await fetchCaliforniaCompany('IRVINE BAY-AREA RENTALS LLC');
      expect(testResult).toEqual({ success: false, data: null, error: 'TIMEOUT' });
      await fetchCaliforniaCompany('IRVINE BAY-AREA RENTALS LLC');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    },
  );
});
