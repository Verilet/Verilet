import { SignIn, SignUp } from '@clerk/react';
import { Navigate, useLocation } from 'react-router-dom';
import { AUTH_PATHS, authPathFor, redirectAfterSignIn, useAuthState } from '../auth/authState';
import { GUIDE } from '../content/guide';
import '../styles/auth.css';

/** Props for the log in and sign up pages. */
interface AuthViewProps {
  /** Which of Clerk's forms to show. */
  mode: 'sign-in' | 'sign-up';
}

/**
 * Shown in place of the form when no Clerk publishable key is set.
 *
 * @returns A note that sign-in isn't available, with setup steps in development.
 */
function SignInUnavailable() {
  return (
    <div className="guide-card auth-page__unavailable" role="status">
      <h2 className="auth-page__unavailable-title">{GUIDE.auth.unavailableTitle}</h2>
      <p>
        {import.meta.env.MODE === 'development'
          ? GUIDE.auth.unavailableDevText
          : GUIDE.auth.unavailableText}
      </p>
    </div>
  );
}

/**
 * The log in and sign up pages: a short reason to have an account beside Clerk's form. Once
 * signed in, visitors go back to the page they wanted, or to the check form.
 *
 * @param props The page's props.
 * @param props.mode Whether to show the log in or the sign up form.
 * @returns The log in or sign up page, a loading message while Clerk starts, or a redirect for a
 *   visitor who is already signed in.
 */
export default function AuthView({ mode }: AuthViewProps) {
  const { configured, isLoaded, isSignedIn } = useAuthState();
  const location = useLocation();
  // Clerk writes the return page as a full address on this site, so the check needs the origin.
  const returnTo = redirectAfterSignIn(location.search, window.location.origin);
  const copy = mode === 'sign-in' ? GUIDE.auth.signIn : GUIDE.auth.signUp;

  // Until Clerk knows whether there is a session, show neither the form nor a redirect.
  if (configured && !isLoaded) {
    return (
      <main className="main main--center">
        <p className="intro__text" role="status">
          Loading…
        </p>
      </main>
    );
  }
  if (isSignedIn) {
    return <Navigate to={returnTo} replace />;
  }

  const clerkForm =
    mode === 'sign-in' ? (
      <SignIn
        routing="path"
        path={AUTH_PATHS.signIn}
        // Switching to sign up keeps the page to come back to.
        signUpUrl={authPathFor(AUTH_PATHS.signUp, returnTo)}
        fallbackRedirectUrl={returnTo}
      />
    ) : (
      <SignUp
        routing="path"
        path={AUTH_PATHS.signUp}
        // Switching to log in keeps the page to come back to.
        signInUrl={authPathFor(AUTH_PATHS.signIn, returnTo)}
        fallbackRedirectUrl={returnTo}
      />
    );
  const form = configured ? clerkForm : <SignInUnavailable />;

  return (
    <main className="guide auth-page">
      <div className="auth-page__layout">
        <section className="auth-page__intro" aria-labelledby="auth-heading">
          <p className="eyebrow">{GUIDE.auth.eyebrow}</p>
          <h1 className="auth-page__title" id="auth-heading">
            {copy.title}
          </h1>
          <p className="auth-page__text">{copy.text}</p>
          <ul className="auth-page__points">
            {GUIDE.auth.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
        <div className="auth-page__form">{form}</div>
      </div>
    </main>
  );
}
