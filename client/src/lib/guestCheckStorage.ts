import { guestCheckSchema, type GuestCheck } from '../schemas/scan';

const STORAGE_KEY = 'verilet:guestCheck';

/**
 * A guest's latest check, kept for this browser tab. It shows the short result after a refresh,
 * and is saved to their account if they sign in.
 */
export function loadGuestCheck(): GuestCheck | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? guestCheckSchema.parse(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

/** Keeps a guest's check for this browser tab. */
export function saveGuestCheck(check: GuestCheck): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(check));
  } catch {
    // Storage can be full or blocked. The result still shows until the page is refreshed.
  }
}

/** Forgets the guest's check, once it is saved to an account or they start a new one. */
export function clearGuestCheck(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is blocked.
  }
}
