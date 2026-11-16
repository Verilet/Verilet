import { z } from 'zod';
import { BEDROOM_VALUES, PAYMENT_VALUES, type ScanResult } from '../types';

/** The listing details, as the API takes them and gives them back. */
const listingFields = {
  listingUrl: z.string(),
  rent: z.number(),
  bedrooms: z.enum(BEDROOM_VALUES),
  location: z.string(),
  landlord: z.string(),
  payment: z.enum(PAYMENT_VALUES),
  securityDeposit: z.number().nullable(),
  applicationFee: z.number().nullable(),
  contactPhone: z.string(),
  description: z.string(),
};

export const scanCheckSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  status: z.enum(['FLAG', 'UNKNOWN', 'OK']),
});

/** A score and the reason for each check, as the API returns them. */
export const scoredSchema = z.object({
  score: z.number(),
  checks: z.array(scanCheckSchema),
});

/** A listing as sent to the API: photo files are counted, not uploaded. */
export const scanPayloadSchema = z.object({ ...listingFields, photoCount: z.number() });
export type ScanPayload = z.infer<typeof scanPayloadSchema>;

/**
 * A saved scan, as the scans API returns it or as this tab stored it. Photo files are never sent
 * or stored, so they come back as an empty list; the checks already reflect them.
 */
export const scanResultSchema = z
  .object({ ...listingFields, id: z.string(), createdAt: z.string(), ...scoredSchema.shape })
  .transform((scan): ScanResult => ({ ...scan, photos: [] }));

/** A guest's check: the listing they sent and its score. Not saved anywhere but this tab. */
export const guestCheckSchema = z.object({
  listing: scanPayloadSchema,
  ...scoredSchema.shape,
});
export type GuestCheck = z.infer<typeof guestCheckSchema>;
