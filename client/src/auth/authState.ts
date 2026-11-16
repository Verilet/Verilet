import { createContext, useContext } from 'react';

/** What the rest of the app needs to know about sign-in, whichever provider is behind it. */
export interface AuthState {
  /** Whether a sign-in provider is set up (a Clerk publishable key is present). */
  configured: boolean;
  /** Whether the provider has finished checking for an existing session. */
  isLoaded: boolean;
  isSignedIn: boolean;
  /** A fresh session token for API calls, or null when signed out. */
  getToken: () => Promise<string | null>;
}

/** The state when sign-in is not set up: nobody can be signed in. */
export const SIGN_IN_UNAVAILABLE: AuthState = {
  configured: false,
  isLoaded: true,
  isSignedIn: false,
  getToken: async () => null,
};

export const AuthContext = createContext<AuthState>(SIGN_IN_UNAVAILABLE);

/** The current sign-in state. Outside an `AuthProvider` it reports sign-in as unavailable. */
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
