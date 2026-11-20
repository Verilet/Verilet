/** Session storage key that remembers the preview choice for the browser tab. */
const STORAGE_KEY = 'verilet:loggedIn';

/**
 * Reads the development preview choice without changing anything. `?loggedIn=true` previews the
 * signed-in screens and `?loggedIn=false` the signed-out ones; without the flag, the choice saved
 * for this tab is used.
 *
 * @param search The page's query string, from React Router's `useLocation().search`.
 * @returns True to preview signed in, false to preview signed out, or null when no preview was
 *   chosen, so the real sign-in state is used.
 */
export function readPreviewFlag(search: string): boolean | null {
  const flag = new URLSearchParams(search).get('loggedIn');
  if (flag === 'true' || flag === 'false') {
    return flag === 'true';
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
