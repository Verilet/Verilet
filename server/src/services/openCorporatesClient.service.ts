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

    if (!apiResponse.ok) {
      // inidcation of timeout and/or other 5xx error
      return { success: false, data: null, error: 'TIMEOUT' };
    }

    const parsedJSON = (await apiResponse.json()) as {
      results?: { companies?: Array<{ company?: openCorpCompanyRecord }> };
    };

    const pulledCompanyRecord = parsedJSON?.results?.companies?.[0]?.company ?? null;

    theLookupCache.set(key, pulledCompanyRecord);
    return { success: true, data: pulledCompanyRecord };
  } catch {
    // In event of a Timeout, abort, network failure, or other unexpected error.
    return { success: false, data: null, error: 'TIMEOUT' };
  }
}
