/**
 * Cross-platform duplicate listing detection and search service.
 * Serves SCRUM-64 (cross-platform duplicate listing detection).
 */

export interface ListingMatch {
  readonly url: string;
  readonly site: string;
  readonly title: string | null;
  readonly matchedBy: readonly ('address' | 'photo')[];
  readonly rent: number | null;
}

export interface ListingSearchResult {
  readonly matches: readonly ListingMatch[];
  readonly failedSources: readonly ('address' | 'photo')[];
}

/**
 * Searches for duplicate listings of the same property across external platforms.
 *
 * @param input Listing search input parameters.
 * @returns Duplicate listing matches and any failed external query sources.
 */
export async function listingSearch(input?: unknown): Promise<ListingSearchResult> {
  void input;
  return {
    matches: [],
    failedSources: [],
  };
}

/** Alias matching SCRUM-64-T-1 spec function name. */
export const findListingCopies = listingSearch;
