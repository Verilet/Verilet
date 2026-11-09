import { z } from 'zod';

/** What a listing page can usually tell us. Everything else is left for the student to enter. */
export const listingAutofillSchema = z.object({
  rent: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
});

export type ListingAutofill = z.infer<typeof listingAutofillSchema>;
export type AutofillListing = (listingUrl: string) => Promise<ListingAutofill>;

/**
 * The parts of the `POST /api/scrape` envelope that autofill uses (see
 * `server/src/services/scraper.service.ts`). Other fields, such as `title` and `photos`, are
 * dropped when parsing.
 */
export const scrapeResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      rent: z.number().nullable(),
      address: z.string().nullable(),
      description: z.string().nullable(),
    })
    .nullable(),
});

export type ScrapeResponse = z.infer<typeof scrapeResponseSchema>;

/** The server gives up on the listing site after 5 seconds, so allow time for that plus the hop. */
export const AUTOFILL_TIMEOUT_MS = 10_000;

const NOTHING_FOUND: ListingAutofill = {};

function text(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Maps a scrape result onto the form's fields. A missing or non-positive rent is left blank. */
export function toListingAutofill(response: ScrapeResponse): ListingAutofill {
  if (!response.success || !response.data) return NOTHING_FOUND;
  const { rent, address, description } = response.data;
  return listingAutofillSchema.parse({
    rent: rent !== null && Number.isFinite(rent) && rent > 0 ? String(rent) : undefined,
    location: text(address),
    description: text(description),
  });
}

export interface AutofillOptions {
  /** API origin, e.g. `http://localhost:5000`. Empty means the same origin as the page. */
  baseUrl?: string;
  timeoutMs?: number;
}

/**
 * Builds an autofill service that asks the server to read the listing page.
 *
 * Any failure (network error, timeout, a 4xx/5xx reply, or a reply in an unexpected shape) is
 * treated as "found nothing", so the form asks the student to fill the details in themselves.
 */
export function createAutofillListing({
  baseUrl = import.meta.env.VITE_API_URL ?? '',
  timeoutMs = AUTOFILL_TIMEOUT_MS,
}: AutofillOptions = {}): AutofillListing {
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/scrape`;

  return async (listingUrl) => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: listingUrl }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return NOTHING_FOUND;

      const parsed = scrapeResponseSchema.safeParse(await response.json());
      return parsed.success ? toListingAutofill(parsed.data) : NOTHING_FOUND;
    } catch {
      return NOTHING_FOUND;
    }
  };
}

export const autofillListing: AutofillListing = createAutofillListing();
