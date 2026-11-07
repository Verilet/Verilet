/**
 * Placeholder for real authentication. Until sign-in exists, open the app with `?loggedIn=true`
 * to preview the logged-in screens.
 */
export function isLoggedInFromUrl(search: string = window.location.search): boolean {
  return new URLSearchParams(search).get('loggedIn') === 'true';
}
