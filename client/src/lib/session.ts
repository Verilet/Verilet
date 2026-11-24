import { z } from 'zod';

/** Session storage key that remembers the signed-in preview for the browser tab. */
const STORAGE_KEY = 'verilet:loggedIn';

/** A preview flag from the query string or storage: only "true" or "false" count. */
const previewFlagSchema = z.enum(['true', 'false']).transform((flag) => flag === 'true');

/**
 * Reads the development preview choice without changing anything. `?loggedIn=true` previews the
 * signed-in screens and `?loggedIn=false` the signed-out ones, for this page load. Without the
 * flag, only a saved signed-in preview is used; nothing ever saves the signed-out preview, so a
 * refresh can't leave someone stuck in it.
 *
 * @param search The page's query string, from React Router's `useLocation().search`.
 * @returns True to preview signed in, false to preview signed out, or null when no preview was
 *   chosen, so the real sign-in state is used.
 */
export function readPreviewFlag(search: string): boolean | null {
  const fromQuery = previewFlagSchema.safeParse(new URLSearchParams(search).get('loggedIn'));
  if (fromQuery.success) {
    return fromQuery.data;
  }
  try {
    const saved = previewFlagSchema.safeParse(sessionStorage.getItem(STORAGE_KEY));
    // An old saved "false" (or anything unexpected) means no preview, never a stuck signed-out one.
    return saved.success && saved.data ? true : null;
  } catch {
    return null;
  }
}

/**
 * Remembers the signed-in preview for the browser tab, so refreshing keeps it. Any other choice
 * clears what was saved, so the next page load follows real sign-in again. Call it from an effect,
 * not while rendering.
 *
 * @param preview True to remember the signed-in preview; false or null to forget any preview.
 */
export function savePreviewFlag(preview: boolean | null): void {
  try {
    if (preview === true) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage can be blocked. The preview still works until the page is refreshed.
  }
}
