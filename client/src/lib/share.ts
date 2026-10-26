import { RATING_LABEL, ratingFromScore } from './risk';
import { scanTitle } from './format';
import type { ScanResult } from '../types';

export function shareText(scan: ScanResult): string {
  const rating = RATING_LABEL[ratingFromScore(scan.score)];
  return `Verilet: ${rating} (${scan.score}/100) · ${scanTitle(scan)}`;
}

/** Copies a short text summary of the result. Resolves false if the clipboard is unavailable. */
export async function copyShareText(scan: ScanResult): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(shareText(scan));
    return true;
  } catch {
    return false;
  }
}
