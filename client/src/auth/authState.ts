import { createContext, useContext } from 'react';
import { z } from 'zod';

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
 * Turns an address Clerk asks the app to open into a path React Router can go to. Clerk passes
 * full addresses such as `http://localhost:5173/sign-up?redirect_url=%2Fscans`, which React
 * Router's `navigate` can't follow, so only the path, query and hash are kept.
 *
 * @param to The address from Clerk, full or already a path.
 * @returns The path with its query and hash, e.g. `/sign-up?redirect_url=%2Fscans`.
 */
export function toAppPath(to: string): string {
  // The base only matters for paths; Clerk only sends this app's own pages here.
  const url = new URL(to, 'http://verilet.invalid');
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Builds a log in or sign up address that returns to a page once the visitor has signed in.
 * Used for the links between the two forms too, so switching forms keeps the return page.
 *
 * @param page The log in or sign up path.
 * @param returnTo Path and query of the page the visitor wanted, e.g. `/scans`.
 * @returns The page with the return page in its query, or the bare page when the return page
 *   is just the default after signing in.
 */
export function authPathFor(page: string, returnTo: string): string {
  if (returnTo === AUTH_PATHS.afterSignIn) {
    return page;
  }
  return `${page}?${new URLSearchParams({ [REDIRECT_PARAM]: returnTo })}`;
}

/**
 * Builds the log in address that returns to a page once the visitor has signed in.
 *
 * @param returnTo Path and query of the page the visitor wanted, e.g. `/scans`.
 * @returns The log in path with the page to return to in its query.
 */
export function signInPathFor(returnTo: string): string {
  return authPathFor(AUTH_PATHS.signIn, returnTo);
}

/**
 * Builds the Zod schema for a page to return to after signing in. It accepts a path on this site
 * (`/scans`) or a full address on this site (Clerk turns the path into one), and always gives
 * back a path. Anything else is rejected, so the link can't send someone to another website:
 * other sites, `//host` and `/\host` (both leave the site in browsers), `javascript:` links,
 * and the log in and sign up pages themselves.
 *
 * @param origin This site's origin, e.g. `http://localhost:5173`.
 * @returns A schema that turns a safe return page into a path.
 */
export function returnPathSchema(origin: string) {
  return z.string().transform((value, ctx) => {
    const isPath = /^\/(?![/\\])/.test(value);
    let url: URL;
    try {
      url = new URL(value, origin);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Not an address' });
      return z.NEVER;
    }
    if (!isPath && url.origin !== origin) {
      ctx.addIssue({ code: 'custom', message: 'Not a page on this site' });
      return z.NEVER;
    }
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (path.startsWith(AUTH_PATHS.signIn) || path.startsWith(AUTH_PATHS.signUp)) {
      ctx.addIssue({ code: 'custom', message: 'Can not return to the log in pages' });
      return z.NEVER;
    }
    return path;
  });
}

/**
 * Finds where to send a visitor after signing in, from the log in page's query.
 *
 * @param search The log in page's query string, e.g. `?redirect_url=%2Fscans`.
 * @param origin This site's origin, used to accept Clerk's full addresses for this site.
 * @returns The path to return to, or `AUTH_PATHS.afterSignIn` when there is no safe one.
 */
export function redirectAfterSignIn(search: string, origin: string): string {
  const result = returnPathSchema(origin).safeParse(
    new URLSearchParams(search).get(REDIRECT_PARAM),
  );
  return result.success ? result.data : AUTH_PATHS.afterSignIn;
}

/**
 * A Clerk publishable key: `pk_test_…` or `pk_live_…` followed by base64 text. Spaces around it,
 * as can slip into an `.env` file, are trimmed.
 */
export const publishableKeySchema = z
  .string()
  .trim()
  .regex(/^pk_(test|live)_[A-Za-z0-9+/=_-]+$/);

/**
 * Reads a Clerk publishable key from any value. Anything that isn't one (null, undefined, a
 * number, an empty string, or a secret key pasted into the wrong variable) gives null, so
 * sign-in turns off instead of the page crashing.
 *
 * @param key The configured key, of any type.
 * @returns The trimmed key, or null when it isn't a publishable key.
 */
export function parsePublishableKey(key: unknown): string | null {
  const result = publishableKeySchema.safeParse(key);
  return result.success ? result.data : null;
}
