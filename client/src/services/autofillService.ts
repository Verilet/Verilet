import { z } from 'zod';
import { postJson } from '../lib/api';

/** Listing fields that can be populated into the submission form from an external listing URL. */
export const listingAutofillSchema = z.object({
  /** Monthly rent formatted as a string for form input, or undefined if not found. */
  rent: z.string().optional(),
  /** Street address or neighborhood location of the rental listing. */
  location: z.string().optional(),
  /** Combined title and description text extracted from the rental posting. */
  description: z.string().optional(),
});

/** Form-compatible listing attributes extracted by the autofill service. */
export type ListingAutofill = z.infer<typeof listingAutofillSchema>;

/** Function contract for invoking listing autofill from a given URL. */
export type AutofillListing = (listingUrl: string) => Promise<ListingAutofill>;

/** Schema for raw scraped listing data returned by the backend POST /api/scrape endpoint. */
export const scrapedListingDataSchema = z.object({
  /** Rental listing headline or title. */
  title: z.string().nullable().optional(),
  /** Extracted numeric monthly rent price. */
  rent: z.number().nullable().optional(),
  /** Address or approximate location string. */
  address: z.string().nullable().optional(),
  /** Body description text of the listing advertisement. */
  description: z.string().nullable().optional(),
  /** Image URLs extracted from the listing page gallery. */
  photos: z.array(z.string()).nullable().optional(),
});

/** Schema for the standard API response envelope returned by the backend scrape service. */
export const scrapeResponseEnvelopeSchema = z.object({
  /** Indicates whether the scraping operation succeeded. */
  success: z.boolean(),
  /** Scraped listing data if successful, null/undefined otherwise. */
  data: scrapedListingDataSchema.nullable().optional(),
  /** Error or status message accompanying the response. */
  message: z.string().optional(),
});

/** Raw listing data scraped by the backend. */
export type ScrapedListingData = z.infer<typeof scrapedListingDataSchema>;

/** Backend scrape endpoint JSON response envelope. */
export type ScrapeResponseEnvelope = z.infer<typeof scrapeResponseEnvelopeSchema>;

/**
 * Calls the backend POST /api/scrape endpoint with the listing URL and normalizes
 * the extracted properties into form-compatible string fields.
 *
 * @param listingUrl The target listing URL to scrape.
 * @returns Normalized rent, location, and combined description.
 * @throws {Error} If the HTTP response is not ok (non-2xx status code).
 */
export const autofillListing: AutofillListing = async (
  listingUrl: string,
): Promise<ListingAutofill> => {
  const parsed = await postJson('/api/scrape', { url: listingUrl }, scrapeResponseEnvelopeSchema);

  if (!parsed.success || !parsed.data) {
    return {};
  }

  const { title, rent, address, description } = parsed.data;

  const normalizedRent = rent !== null && rent !== undefined ? String(rent) : undefined;
  const normalizedLocation = address?.trim() || undefined;

  const trimmedTitle = title?.trim() || '';
  const trimmedDesc = description?.trim() || '';
  let combinedDescription: string | undefined;

  if (trimmedTitle && trimmedDesc) {
    combinedDescription = `${trimmedTitle}\n\n${trimmedDesc}`;
  } else if (trimmedTitle) {
    combinedDescription = trimmedTitle;
  } else if (trimmedDesc) {
    combinedDescription = trimmedDesc;
  }

  return listingAutofillSchema.parse({
    rent: normalizedRent,
    location: normalizedLocation,
    description: combinedDescription,
  });
};
