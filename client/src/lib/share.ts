import { RATING_LABEL } from './risk';
import { scanTitle } from './format';
import type { ScanResult } from '../types';

/** How the most recent share went, shown on that scan's share button for a moment. */
export interface ShareStatus {
  /** The scan that was shared. */
  id: string;
  /** Whether the summary was copied. */
  ok: boolean;
}

/**
 * The text of a scan's share button: its usual label, or how the last copy of that scan went.
 *
 * @param scanId The scan the button shares.
 * @param status The most recent share, if any.
 * @param idleLabel The button's usual text, e.g. "Share result".
 * @returns The usual text, "Copied" or "Couldn't copy".
 */
export function shareButtonLabel(
  scanId: string,
  status: ShareStatus | null,
  idleLabel: string,
): string {
  if (status?.id !== scanId) {
    return idleLabel;
  }
  return status.ok ? 'Copied' : "Couldn't copy";
}

/**
 * Builds a one-line text summary of a scan.
 *
 * @param scan The scan to summarise.
 * @returns e.g. "Verilet: HIGH RISK (82/100) · 2 bed · $1,200 · Santa Cruz, CA".
 */
export function shareText(scan: ScanResult): string {
  const rating = RATING_LABEL[scan.rating];
  const scorePart = scan.score !== null ? ` (${scan.score}/100)` : '';
  return `Verilet: ${rating}${scorePart} · ${scanTitle(scan)}`;
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
