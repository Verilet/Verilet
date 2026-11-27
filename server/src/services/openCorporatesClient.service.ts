import { z } from 'zod';

export const openCorpQueryScehma = z.string().trim().min(1);
export type openCorpQuery = z.infer<typeof openCorpQueryScehma>;

export interface openCorpCompanyRecord {
  name: string;
  company_number: string;
  current_status?: string | null;
  jurisdiction_code: string;
}

export type openCorpErrorTypes =
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'API_KEY_MISSING'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'UPSTREAM_ERROR'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE';

export interface openCorpResult {
  success: boolean;
  data: openCorpCompanyRecord | null;
  error?: openCorpErrorTypes;
}

export interface companyOptionsFetched {
  apiKey?: string;
}

const ocCompanyRecordSchema = z.object({
  name: z.string(),
  company_number: z.string(),
  current_status: z.string().nullish(),
  jurisdiction_code: z.string(),
});

const ocResponseSchema = z.object({
  results: z
    .object({
      companies: z.array(z.object({ company: ocCompanyRecordSchema })).optional(),
    })
    .optional(),
});

const apiURL = 'https://api.opencorporates.com/v0.4/companies/search';
const defaultRequestTimeoutMS = 5000;

const theLookupCache = new Map<string, openCorpCompanyRecord | null>();

export function clearCompanyCache(): void {
  theLookupCache.clear();
}

export async function fetchCaliforniaCompany(
  query: unknown,
  options?: companyOptionsFetched,
): Promise<openCorpResult> {
  // Validate so that non-strong or blank inpurs nver reach the cache or the network
  const validation = openCorpQueryScehma.safeParse(query);
  if (!validation.success) {
    return { success: true, data: null };
  }

  const validatedAndTrimmedQuery = validation.data;

  // Lookup the cache with the nomalized key. If found, return the cached result.
  const key = validatedAndTrimmedQuery.toLowerCase();
  if (theLookupCache.has(key)) {
    return { success: true, data: theLookupCache.get(key) ?? null };
  }

  // Determine which API key to use; bails is there is no key available.
  const currAPIkey = (options?.apiKey || process.env.OPENCORPORATES_API_KEY || '').trim();
  if (!currAPIkey) {
    return { success: true, data: null, error: 'API_KEY_MISSING' };
  }

  // Construct the URL from the validated and trimmed query
  const lowerHalfUrl = `${apiURL}?q=${encodeURIComponent(validatedAndTrimmedQuery)}`;
  const upperHalfUrl = `&jurisdiction_code=us_ca&api_token=${encodeURIComponent(currAPIkey)}`;
  const fullUrl = lowerHalfUrl + upperHalfUrl;

  try {
    const apiResponse = await fetch(fullUrl, {
      signal: AbortSignal.timeout(defaultRequestTimeoutMS),
    });
    if (apiResponse.status === 429) {
      return { success: false, data: null, error: 'RATE_LIMITED' };
    }

    /*
    if (!apiResponse.ok) {
      // inidcation of timeout and/or other 5xx error
      return { success: false, data: null, error: 'TIMEOUT' };
    }
    */

    if (apiResponse.status === 401 || apiResponse.status === 403) {
      return { success: false, data: null, error: 'UNAUTHORIZED' };
    }

    if (apiResponse.status === 404) {
      return { success: false, data: null, error: 'NOT_FOUND' };
    }

    if (!apiResponse.ok) {
      // indication of 5xx error or other unexpected non-2xx error
      return { success: false, data: null, error: 'UPSTREAM_ERROR' };
    }

    const parsedJSON: unknown = await apiResponse.json();
    const validatedResponse = ocResponseSchema.safeParse(parsedJSON);
    if (!validatedResponse.success) {
      return { success: false, data: null, error: 'INVALID_RESPONSE' };
    }

    const pulledCompanyRecord = validatedResponse.data?.results?.companies?.[0]?.company ?? null;

    theLookupCache.set(key, pulledCompanyRecord);
    return { success: true, data: pulledCompanyRecord };
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === 'AbortError' || error.name === 'TimeoutError')
    ) {
      return { success: false, data: null, error: 'TIMEOUT' };
    }
    return { success: false, data: null, error: 'NETWORK_ERROR' };
  }
}
