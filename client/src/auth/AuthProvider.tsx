import { lazy, Suspense, type ReactNode } from 'react';
import { readClientEnv } from '../lib/env';
import { AuthContext, parsePublishableKey, SIGN_IN_UNAVAILABLE } from './authState';

/** Clerk is a large download, so it is split out and only fetched when sign-in is set up. */
const ClerkAuth = lazy(() => import('./ClerkAuth'));

/** Props for the app-wide sign-in provider. */
interface AuthProviderProps {
  /** Clerk publishable key. Defaults to the checked `VITE_CLERK_PUBLISHABLE_KEY`. Null turns sign-in off. */
  publishableKey?: string | null;
  /** The app, which can then read the sign-in state with `useAuthState`. */
  children: ReactNode;
}

/**
 * Shown for the moment Clerk's code takes to download. The app itself waits, so it is mounted
 * once, inside Clerk, instead of being mounted, thrown away and mounted again.
 *
 * @returns A loading message.
 */
function ClerkLoading() {
  return (
    <main className="main main--center">
      <p className="intro__text" role="status">
        Loading…
      </p>
    </main>
  );
}

/**
 * Sets up sign-in. With a valid Clerk publishable key it loads Clerk on demand and wraps the app
 * in it. Without one (or with a key that isn't a publishable key) the app still runs, and the
 * sign-in page says sign-in is unavailable. Must be inside the router.
 *
 * @param props The provider's props.
 * @param props.publishableKey Clerk publishable key; sign-in is turned off without a valid one.
 * @param props.children The app.
 * @returns The app wrapped in Clerk, or in the sign-in-unavailable state.
 */
export default function AuthProvider({
  publishableKey = readClientEnv().clerkPublishableKey,
  children,
}: AuthProviderProps) {
  const key = parsePublishableKey(publishableKey);
  if (key === null) {
    return <AuthContext.Provider value={SIGN_IN_UNAVAILABLE}>{children}</AuthContext.Provider>;
  }

  return (
    <Suspense fallback={<ClerkLoading />}>
      <ClerkAuth publishableKey={key}>{children}</ClerkAuth>
    </Suspense>
  );
}
