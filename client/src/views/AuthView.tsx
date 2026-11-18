import { SignIn, SignUp } from '@clerk/react';
import { Navigate, useLocation } from 'react-router-dom';
import { AUTH_PATHS, redirectAfterSignIn, useAuthState } from '../auth/authState';
import PageFadeIn from '../components/PageFadeIn';
import { GUIDE } from '../content/guide';
import { readCarArrival } from '../lib/carArrival';

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
      <p>{import.meta.env.DEV ? GUIDE.auth.unavailableDevText : GUIDE.auth.unavailableText}</p>
    </div>
  );
}

/**
 * The log in and sign up pages: a short reason to have an account beside Clerk's form. Once
 * signed in, visitors go back to the page they wanted, or to the check form.
 *
 * @param props The page's props.
 * @param props.mode Whether to show the log in or the sign up form.
 * @returns The log in or sign up page, or a redirect for a visitor who is already signed in.
 */
export default function AuthView({ mode }: AuthViewProps) {
  const { configured, isSignedIn } = useAuthState();
  const location = useLocation();
  // A car transition to the check form ends here for signed-out visitors.
  const arrivedByCar = readCarArrival(location.state) !== null;
  const returnTo = redirectAfterSignIn(location.search);
  const copy = mode === 'sign-in' ? GUIDE.auth.signIn : GUIDE.auth.signUp;

  if (isSignedIn) {
    return <Navigate to={returnTo} replace />;
  }

  const clerkForm =
    mode === 'sign-in' ? (
      <SignIn
        routing="path"
        path={AUTH_PATHS.signIn}
        signUpUrl={AUTH_PATHS.signUp}
        fallbackRedirectUrl={returnTo}
      />
    ) : (
      <SignUp
        routing="path"
        path={AUTH_PATHS.signUp}
        signInUrl={AUTH_PATHS.signIn}
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
      {arrivedByCar && <PageFadeIn />}
    </main>
  );
}
