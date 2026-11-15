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
 * PLACEHOLDER AUTOFILL SERVICE.
 *
 * The scraper does not exist yet, so this finds nothing and the form asks the student to fill the
 * details in. It deliberately returns no sample values, because made-up rent would feed into the
 * risk rating. Replace the body with a call to `POST /api/scrape` (see docs/architecture.md),
 * parsing the response with `listingAutofillSchema`; keep the signature.
 */
export const autofillListing: AutofillListing = async () => listingAutofillSchema.parse({});
