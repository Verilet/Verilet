import { BEDROOM_OPTIONS, type ScanResult } from '../types';

export function formatRent(rent: number): string {
  return `$${rent.toLocaleString('en-US')}`;
}

export function bedroomLabel(bedrooms: ScanResult['bedrooms']): string {
  return BEDROOM_OPTIONS.find((option) => option.value === bedrooms)?.label ?? bedrooms;
}

/** "2 bed · $1,200 · Santa Cruz, CA" (My scans table). */
export function scanTitle(scan: ScanResult): string {
  return `${bedroomLabel(scan.bedrooms)} · ${formatRent(scan.rent)} · ${scan.location}`;
}

/** "2 bed · $1,200 · Santa Cruz" (Recent scans card, city only). */
export function scanShortTitle(scan: ScanResult): string {
  const city = scan.location.split(',')[0].trim();
  return `${bedroomLabel(scan.bedrooms)} · ${formatRent(scan.rent)} · ${city}`;
}

/** "2 bed · $1,200 / month · Santa Cruz, CA" (results header). */
export function scanMeta(scan: ScanResult): string {
  return `${bedroomLabel(scan.bedrooms)} · ${formatRent(scan.rent)} / month · ${scan.location}`;
}

export function listingHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Today", "Yesterday", or "Oct 15". */
export function formatScanDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
