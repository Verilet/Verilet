import { z } from 'zod';
import { scanResultSchema } from '../schemas/scan';
import type { ScanResult } from '../types';

const STORAGE_KEY = 'verilet:scans';

const storedScansSchema = z.array(scanResultSchema);

/**
 * Loads the development preview's scans for this browser tab, so a refreshed results page can
 * still open them. Signed-in students' scans come from the scans API instead.
 */
export function loadScans(): ScanResult[] | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const scans = storedScansSchema.parse(JSON.parse(stored));
    return scans.length > 0 ? scans : null;
  } catch {
    return null;
  }
}

/** Saves scans for this browser tab. Photo files are left out because they can't be stored. */
export function saveScans(scans: ScanResult[]): void {
  try {
    const withoutPhotos = (key: string, value: unknown) => (key === 'photos' ? undefined : value);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(scans, withoutPhotos));
  } catch {
    // Storage can be full or blocked. The scans still work until the page is refreshed.
  }
}
