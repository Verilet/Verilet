import { ClerkProvider, useAuth } from '@clerk/react';
import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AUTH_PATHS, AuthContext, SIGN_IN_UNAVAILABLE } from './authState';
import { CLERK_APPEARANCE } from './clerkAppearance';

interface AuthProviderProps {
  /** Clerk publishable key. Defaults to `VITE_CLERK_PUBLISHABLE_KEY`. */
  publishableKey?: string;
  children: ReactNode;
}

/** Shares Clerk's session state through `AuthContext`. */
function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const state = useMemo(
    () => ({
      configured: true,
      isLoaded,
      isSignedIn: Boolean(isSignedIn),
      getToken: () => getToken(),
    }),
    [isLoaded, isSignedIn, getToken],
  );
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

/**
 * Sets up sign-in. With a Clerk publishable key it wraps the app in Clerk, using React Router for
 * Clerk's page changes. Without one the app still runs, and the sign-in page says sign-in is
 * unavailable. Must be inside the router.
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
