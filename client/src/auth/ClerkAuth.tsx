import { ClerkProvider, useAuth } from '@clerk/react';
import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AUTH_PATHS, AuthContext, type AuthState } from './authState';
import { CLERK_APPEARANCE } from './clerkAppearance';

/** Props for the Clerk-backed sign-in provider. */
interface ClerkAuthProps {
  /** Clerk publishable key. */
  publishableKey: string;
  /** The app, which reads the session through `AuthContext`. */
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
 * Wraps the app in Clerk, using React Router for Clerk's page changes. Loaded on demand by
 * `AuthProvider`, so Clerk's code is only downloaded when sign-in is set up.
 *
 * @param props The provider's props.
 * @param props.publishableKey Clerk publishable key.
 * @param props.children The app.
 * @returns The app wrapped in Clerk.
 */
export default function ClerkAuth({ publishableKey, children }: ClerkAuthProps) {
  const navigate = useNavigate();

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
