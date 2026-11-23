import { ClerkProvider, useAuth } from '@clerk/react';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { AUTH_PATHS, AuthContext, toAppPath, type AuthState } from './authState';
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
      // Options such as a JWT template are passed straight through to Clerk. A failed request
      // gives null, like being signed out, instead of an error the caller has to handle.
      getToken: (options) => getToken(options).catch(() => null),
    }),
    [isLoaded, isSignedIn, getToken],
  );
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

/** Holds the navigate function Clerk's page changes go through. */
interface RouterHolder {
  /** React Router's navigate for the mounted app, or null before it mounts. */
  navigate: NavigateFunction | null;
}

/**
 * The router's current navigate function, for Clerk's page changes. Clerk keeps the router
 * functions it is given the first time it starts and never takes new ones, so they can't hold
 * on to any one render's navigate (that render may be thrown away, leaving a navigate React
 * Router ignores). They read this instead, which `RouterBridge` keeps up to date.
 */
const router: RouterHolder = { navigate: null };

/**
 * Opens a page for Clerk, e.g. when switching from log in to sign up.
 *
 * @param to The address from Clerk.
 */
function routerPush(to: string) {
  router.navigate?.(toAppPath(to));
}

/**
 * Replaces the current page for Clerk, e.g. between the steps of a sign-in.
 *
 * @param to The address from Clerk.
 */
function routerReplace(to: string) {
  router.navigate?.(toAppPath(to), { replace: true });
}

/**
 * Keeps `router.navigate` pointing at the navigate function of the mounted app.
 *
 * @returns Nothing; it only runs an effect.
 */
function RouterBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    router.navigate = navigate;
  }, [navigate]);
  return null;
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
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      routerPush={routerPush}
      routerReplace={routerReplace}
      signInUrl={AUTH_PATHS.signIn}
      signUpUrl={AUTH_PATHS.signUp}
      afterSignOutUrl={AUTH_PATHS.afterSignOut}
      appearance={CLERK_APPEARANCE}
    >
      <RouterBridge />
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}
