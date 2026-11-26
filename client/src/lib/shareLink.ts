import { z } from 'zod';
import { BEDROOM_VALUES, PAYMENT_VALUES, type ScanResult } from '../types';

/** Where shared results open. */
const SHARED_PATH = '/shared/';

/**
 * Whether a string is an http or https link, so a shared listing link can't run script.
 *
 * @param value The text to test.
 * @returns True for an http(s) URL.
 */
function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** A deposit or fee in a shared result: 0 or more, or null when the listing didn't say. */
const optionalAmount = z.number().finite().min(0).nullable();

/**
 * The part of a scan that goes into a share link. The contact phone, landlord name, description,
 * photos and ID are left out, so a link never carries personal details.
 */
export const sharedScanSchema = z.strictObject({
  listingUrl: z.string().max(2048).refine(isHttpUrl),
  rent: z.number().finite().positive(),
  bedrooms: z.enum(BEDROOM_VALUES),
  location: z.string().max(200),
  payment: z.enum(PAYMENT_VALUES),
  securityDeposit: optionalAmount,
  applicationFee: optionalAmount,
  score: z.number().int().min(0).max(100),
  checks: z
    .array(
      z.strictObject({
        id: z.string().max(60),
        title: z.string().max(120),
        detail: z.string().max(1000),
        status: z.enum(['FLAG', 'UNKNOWN', 'OK']),
      }),
    )
    .min(1)
    .max(20),
  createdAt: z.iso.datetime(),
});

/** A result as a share link carries it. */
export type SharedScan = z.infer<typeof sharedScanSchema>;

/**
 * Picks the shareable fields of a scan.
 *
 * @param scan The scan to share.
 * @returns Only the fields a share link may carry.
 */
function shareableFields(scan: ScanResult): SharedScan {
  return {
    listingUrl: scan.listingUrl,
    rent: scan.rent,
    bedrooms: scan.bedrooms,
    location: scan.location,
    payment: scan.payment,
    securityDeposit: scan.securityDeposit,
    applicationFee: scan.applicationFee,
    score: scan.score,
    checks: scan.checks.map(({ id, title, detail, status }) => ({ id, title, detail, status })),
    createdAt: scan.createdAt,
  };
}

/**
 * Encodes text as URL-safe base64: `-` and `_` instead of `+` and `/`, with no `=` padding.
 *
 * @param text The text, which may hold any Unicode characters.
 * @returns The encoded text.
 */
function toBase64Url(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes URL-safe base64 back into text.
 *
 * @param data The encoded text.
 * @returns The text, or null when it isn't URL-safe base64 or valid UTF-8.
 */
function fromBase64Url(data: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(data)) {
    return null;
  }
  try {
    const binary = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Builds the path of a link that opens a read-only copy of a scan's result.
 *
 * @param scan The scan to share.
 * @returns e.g. `/shared/eyJsaXN0aW5nVXJsIjoi...`.
 */
export function sharePathFor(scan: ScanResult): string {
  return `${SHARED_PATH}${toBase64Url(JSON.stringify(shareableFields(scan)))}`;
}

/**
 * Reads the result a share link carries. Never throws.
 *
 * @param data The part of the link after `/shared/`.
 * @returns The shared result, or null when the link is broken or has been edited into something
 *   that isn't a valid result.
 */
export function readSharedScan(data: string): SharedScan | null {
  const text = fromBase64Url(data);
  if (text === null) {
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const result = sharedScanSchema.safeParse(json);
  return result.success ? result.data : null;
}
