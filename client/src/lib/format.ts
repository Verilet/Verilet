import { BEDROOM_OPTIONS, type ScanResult } from '../types';

/** "$1,200". */
export function formatRent(rent: number): string {
  return `$${rent.toLocaleString('en-US')}`;
}

/** "2 bed", from a stored bedroom value. */
export function bedroomLabel(bedrooms: ScanResult['bedrooms']): string {
  return BEDROOM_OPTIONS.find((option) => option.value === bedrooms)?.label ?? bedrooms;
}

/** "2 bed · $1,200 / month · Santa Cruz, CA" (results header). */
export function scanMeta(scan: ScanResult): string {
  return `${bedroomLabel(scan.bedrooms)} · ${formatRent(scan.rent)} / month · ${scan.location}`;
}
