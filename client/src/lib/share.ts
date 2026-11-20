import { RATING_LABEL, ratingFromScore } from './risk';
import { scanTitle } from './format';
import type { ScanResult } from '../types';

/**
 * Builds a one-line text summary of a scan.
 *
 * @param scan The scan to summarise.
 * @returns e.g. "Verilet: HIGH RISK (82/100) · 2 bed · $1,200 · Santa Cruz, CA".
 */
export function shareText(scan: ScanResult): string {
  const rating = RATING_LABEL[ratingFromScore(scan.score)];
  return `Verilet: ${rating} (${scan.score}/100) · ${scanTitle(scan)}`;
}

/**
 * Copies a short text summary of the result.
 *
 * @param scan The scan to share.
 * @returns True once copied, or false if the clipboard is unavailable.
 */
export async function copyShareText(scan: ScanResult): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(shareText(scan));
    return true;
  } catch {
    return false;
  }
}
