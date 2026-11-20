import { createContext, useContext } from 'react';

/** Options for requesting a session token, passed straight through to the sign-in provider. */
export interface TokenOptions {
  /** Name of a JWT template to sign the token with. */
  template?: string;
  /** Fetch a new token instead of reusing a cached one. */
  skipCache?: boolean;
}

/** What the rest of the app needs to know about sign-in, whichever provider is behind it. */
export interface AuthState {
  /** Whether a sign-in provider is set up (a Clerk publishable key is present). */
  configured: boolean;
  /** Whether the provider has finished checking for an existing session. */
  isLoaded: boolean;
  /** Whether a user is signed in with a real account. */
  isSignedIn: boolean;
  /** A fresh session token for API calls, or null when signed out. */
  getToken: (options?: TokenOptions) => Promise<string | null>;
}

/** The state when sign-in is not set up: nobody can be signed in. */
export const SIGN_IN_UNAVAILABLE: AuthState = {
  configured: false,
  isLoaded: true,
  isSignedIn: false,
  getToken: async () => null,
};

/** Shares the current sign-in state with the app. Provided by `AuthProvider`. */
export const AuthContext = createContext<AuthState>(SIGN_IN_UNAVAILABLE);

/**
 * Reads the current sign-in state.
 *
 * @returns The sign-in state, or `SIGN_IN_UNAVAILABLE` outside an `AuthProvider`.
 */
export function useAuthState(): AuthState {
  return useContext(AuthContext);
}

/** Where the sign-in and sign-up pages live, and where people go once they are signed in. */
export const AUTH_PATHS = {
  signIn: '/login',
  signUp: '/sign-up',
  afterSignIn: '/check',
  afterSignOut: '/',
} as const;

/** Query parameter that carries the page to return to after signing in. Clerk reads it too. */
export const REDIRECT_PARAM = 'redirect_url';

/**
 * Builds the log in address that returns to a page once the visitor has signed in.
 *
 * @param returnTo Path and query of the page the visitor wanted, e.g. `/scans`.
 * @returns The log in path with the page to return to in its query.
 */
export function signInPathFor(returnTo: string): string {
  return `${AUTH_PATHS.signIn}?${new URLSearchParams({ [REDIRECT_PARAM]: returnTo })}`;
}

/**
 * Finds where to send a visitor after signing in, from the log in page's query. Only paths on
 * this site are allowed, so the link can't send someone to another website.
 *
 * @param search The log in page's query string, e.g. `?redirect_url=%2Fscans`.
 * @returns The path to return to, or `AUTH_PATHS.afterSignIn` when there is no safe one.
 */
export function redirectAfterSignIn(search: string): string {
  const target = new URLSearchParams(search).get(REDIRECT_PARAM);
  // "//host" and "/\host" both leave the site in browsers, so only a single leading slash counts.
  const isSitePath = target !== null && /^\/(?![/\\])/.test(target);
  const isAuthPage =
    target !== null &&
    (target.startsWith(AUTH_PATHS.signIn) || target.startsWith(AUTH_PATHS.signUp));
  return isSitePath && !isAuthPage ? target : AUTH_PATHS.afterSignIn;
}

/** Clerk publishable keys look like `pk_test_…` or `pk_live_…` followed by base64 text. */
const PUBLISHABLE_KEY_PATTERN = /^pk_(test|live)_[A-Za-z0-9+/=_-]+$/;

/**
 * Checks that a value looks like a Clerk publishable key, so a typo or a secret key pasted into
 * the wrong variable turns sign-in off instead of breaking every page.
 *
 * @param key The configured key, if any.
 * @returns True when the key has the shape of a publishable key.
 */
export function isPublishableKey(key: string | undefined): key is string {
  return key !== undefined && PUBLISHABLE_KEY_PATTERN.test(key.trim());
}
