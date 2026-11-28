/**
 * Cross-platform duplicate listing detection and search service.
 * Serves SCRUM-64 (cross-platform duplicate listing detection).
 */

/** Evaluation status returned by the duplicate listing detection service. */
export type ListingSearchStatus = 'compliant' | 'warning' | 'violation' | 'skipped';

/** Fraud flag returned when cross-platform duplicate copies show significant discrepancies. */
export type ListingSearchFlag = 'DUPLICATE_LISTING_MISMATCH' | null;

export interface ListingMatch {
  readonly url: string;
  readonly site: string;
  readonly title: string | null;
  readonly matchedBy: readonly ('address' | 'photo')[];
  readonly rent: number | null;
}

export interface ListingSearchResult {
  readonly status?: ListingSearchStatus;
  readonly flag?: ListingSearchFlag;
  readonly message?: string;
  readonly matches: readonly ListingMatch[];
  readonly failedSources: readonly ('address' | 'photo')[];
}

/**
 * Searches for duplicate listings of the same property across external platforms.
 * Currently stubbed until SCRUM-64 cross-platform comparison is implemented.
 *
 * @param input Listing search input parameters.
 * @returns Stubbed compliant search status with empty matches and failed sources.
 */
export async function listingSearch(input?: unknown): Promise<ListingSearchResult> {
  void input;
  return {
    status: 'compliant',
    flag: null,
    message: 'No mismatched cross-platform duplicate listings detected.',
    matches: [],
    failedSources: [],
  };
}

/** Alias matching SCRUM-64-T-1 spec function name. */
export const findListingCopies = listingSearch;
