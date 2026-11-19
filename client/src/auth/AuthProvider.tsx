import { lazy, Suspense, type ReactNode } from 'react';
import { AuthContext, SIGN_IN_UNAVAILABLE, type AuthState } from './authState';

/** Clerk is a large download, so it is split out and only fetched when sign-in is set up. */
const ClerkAuth = lazy(() => import('./ClerkAuth'));

/** The state while Clerk's code is still downloading: sign-in is set up but not ready yet. */
const CLERK_LOADING: AuthState = {
  configured: true,
  isLoaded: false,
  isSignedIn: false,
  getToken: async () => null,
};

/** Props for the app-wide sign-in provider. */
interface AuthProviderProps {
  /** Clerk publishable key. Defaults to `VITE_CLERK_PUBLISHABLE_KEY`. */
  publishableKey?: string;
  /** The app, which can then read the sign-in state with `useAuthState`. */
  children: ReactNode;
}

/**
 * Sets up sign-in. With a Clerk publishable key it loads Clerk on demand and wraps the app in it;
 * until then the app sees sign-in as still loading. Without a key the app still runs, and the
 * sign-in page says sign-in is unavailable. Must be inside the router.
 *
 * @param props The provider's props.
 * @param props.publishableKey Clerk publishable key; sign-in is turned off without one.
 * @param props.children The app.
 * @returns The app wrapped in Clerk, or in the loading or sign-in-unavailable state.
 */
export default function AuthProvider({
  publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  children,
}: AuthProviderProps) {
  if (!publishableKey) {
    return <AuthContext.Provider value={SIGN_IN_UNAVAILABLE}>{children}</AuthContext.Provider>;
  }

  return (
    <Suspense
      fallback={<AuthContext.Provider value={CLERK_LOADING}>{children}</AuthContext.Provider>}
    >
      <ClerkAuth publishableKey={publishableKey}>{children}</ClerkAuth>
    </Suspense>
  );
}
