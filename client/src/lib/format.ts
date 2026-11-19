import { BEDROOM_OPTIONS, type ScanResult } from '../types';

/**
 * Formats a rent in whole dollars.
 *
 * @param rent Monthly rent in USD.
 * @returns e.g. "$1,200".
 */
export function formatRent(rent: number): string {
  return `$${rent.toLocaleString('en-US')}`;
}

/**
 * The label for a stored bedroom value.
 *
 * @param bedrooms Bedroom value from the form, e.g. "2".
 * @returns e.g. "2 bed".
 */
export function bedroomLabel(bedrooms: ScanResult['bedrooms']): string {
  return BEDROOM_OPTIONS.find((option) => option.value === bedrooms)?.label ?? bedrooms;
}

/** Ways to shorten or extend a scan's one-line summary. */
interface ScanSummaryOptions {
  /** Add " / month" after the rent. */
  perMonth?: boolean;
  /** Show only the city: the part of the location before the first comma. */
  cityOnly?: boolean;
}

/**
 * Describes a scan in one line: bedrooms, rent and place. The titles below all use this.
 *
 * @param scan The scan.
 * @param options Whether to add "/ month" or show the city only.
 * @returns e.g. "2 bed · $1,200 · Santa Cruz, CA".
 */
export function scanSummary(
  scan: ScanResult,
  { perMonth = false, cityOnly = false }: ScanSummaryOptions = {},
): string {
  const rent = perMonth ? `${formatRent(scan.rent)} / month` : formatRent(scan.rent);
  const place = cityOnly ? scan.location.split(',')[0].trim() : scan.location;
  return `${bedroomLabel(scan.bedrooms)} · ${rent} · ${place}`;
}

/**
 * Title of a scan for the My scans table.
 *
 * @param scan The scan.
 * @returns e.g. "2 bed · $1,200 · Santa Cruz, CA".
 */
export function scanTitle(scan: ScanResult): string {
  return scanSummary(scan);
}

/**
 * Short title of a scan for the recent scans card, with the city only.
 *
 * @param scan The scan.
 * @returns e.g. "2 bed · $1,200 · Santa Cruz".
 */
export function scanShortTitle(scan: ScanResult): string {
  return scanSummary(scan, { cityOnly: true });
}

/**
 * Summary of a scan for the results page header.
 *
 * @param scan The scan.
 * @returns e.g. "2 bed · $1,200 / month · Santa Cruz, CA".
 */
export function scanMeta(scan: ScanResult): string {
  return scanSummary(scan, { perMonth: true });
}

/**
 * The website a listing is on.
 *
 * @param url The listing link.
 * @returns e.g. "zillow.com", or the original text if it is not a valid URL.
 */
export function listingHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Midnight at the start of the given local day.
 *
 * @param date Any time on that day.
 * @returns Milliseconds since the epoch at local midnight.
 */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * When a scan was made, in words.
 *
 * @param iso ISO timestamp of the scan.
 * @param now The current time. Defaults to now.
 * @returns "Today", "Yesterday", or a date like "Oct 15".
 */
export function formatScanDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) {
    return 'Today';
  }
  if (days === 1) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
