/** Session storage key that remembers the preview choice for the browser tab. */
const STORAGE_KEY = 'verilet:loggedIn';

/**
 * Reads the development preview choice without changing anything. `?loggedIn=true` in the address
 * previews the signed-in screens and `?loggedIn=false` clears the preview; otherwise the choice
 * saved for this tab is used.
 *
 * @param search Query string to read the flag from. Defaults to the current page's.
 * @returns True to preview signed in, false to preview signed out, or null to follow real sign-in.
 */
export function readPreviewFlag(search: string = window.location.search): boolean | null {
  const flag = new URLSearchParams(search).get('loggedIn');
  if (flag === 'true') {
    return true;
  }
  if (flag === 'false') {
    return null;
  }
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved === null ? null : saved === 'true';
  } catch {
    return null;
  }
}

/**
 * Remembers the preview choice for the browser tab, so refreshing keeps the same screens. Call it
 * from an effect, not while rendering.
 *
 * @param preview True or false to remember a preview, or null to forget it.
 */
export function savePreviewFlag(preview: boolean | null): void {
  try {
    if (preview === null) {
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, String(preview));
    }
  } catch {
    // Storage can be blocked. The preview still works until the page is refreshed.
  }
}
