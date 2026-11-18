import { ClerkProvider, useAuth } from '@clerk/react';
import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AUTH_PATHS, AuthContext, SIGN_IN_UNAVAILABLE, type AuthState } from './authState';
import { CLERK_APPEARANCE } from './clerkAppearance';

/** Props for the app-wide sign-in provider. */
interface AuthProviderProps {
  /** Clerk publishable key. Defaults to `VITE_CLERK_PUBLISHABLE_KEY`. */
  publishableKey?: string;
  /** The app, which can then read the sign-in state with `useAuthState`. */
  children: ReactNode;
}

/** Props for the bridge between Clerk's session and `AuthContext`. */
interface ClerkAuthBridgeProps {
  /** The app, which reads the session through `AuthContext`. */
  children: ReactNode;
}

/**
 * Shares Clerk's session state through `AuthContext`, so the rest of the app never imports Clerk.
 *
 * @param props The bridge's props.
 * @param props.children The app.
 * @returns The app inside an `AuthContext` provider.
 */
function ClerkAuthBridge({ children }: ClerkAuthBridgeProps) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const state = useMemo<AuthState>(
    () => ({
      configured: true,
      isLoaded,
      isSignedIn: Boolean(isSignedIn),
      // Options such as a JWT template are passed straight through to Clerk.
      getToken: (options) => getToken(options),
    }),
    [isLoaded, isSignedIn, getToken],
  );
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

/**
 * Sets up sign-in. With a Clerk publishable key it wraps the app in Clerk, using React Router for
 * Clerk's page changes. Without one the app still runs, and the sign-in page says sign-in is
 * unavailable. Must be inside the router.
 *
 * @param props The provider's props.
 * @param props.publishableKey Clerk publishable key; sign-in is turned off without one.
 * @param props.children The app.
 * @returns The app wrapped in Clerk, or in the sign-in-unavailable state.
 */
export default function AuthProvider({
  publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  children,
}: AuthProviderProps) {
  const navigate = useNavigate();

  if (!publishableKey) {
    return <AuthContext.Provider value={SIGN_IN_UNAVAILABLE}>{children}</AuthContext.Provider>;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl={AUTH_PATHS.signIn}
      signUpUrl={AUTH_PATHS.signUp}
      afterSignOutUrl={AUTH_PATHS.afterSignOut}
      appearance={CLERK_APPEARANCE}
    >
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}
