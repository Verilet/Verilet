const STORAGE_KEY = 'verilet:loggedIn';

/**
 * Placeholder for real authentication. Until sign-in exists, open the app with `?loggedIn=true`
 * to preview the logged-in screens. The flag is remembered for the browser tab so navigating
 * between pages (or refreshing) keeps the logged-in screens.
 */
export function isLoggedInFromUrl(search: string = window.location.search): boolean {
  const flag = new URLSearchParams(search).get('loggedIn');
  try {
    if (flag === 'true') sessionStorage.setItem(STORAGE_KEY, 'true');
    if (flag === 'false') sessionStorage.removeItem(STORAGE_KEY);
    return flag === 'true' || sessionStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return flag === 'true';
  }
}
