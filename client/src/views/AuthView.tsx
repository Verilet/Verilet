import { SignIn, SignUp } from '@clerk/react';
import { Navigate, useLocation } from 'react-router-dom';
import { AUTH_PATHS, useAuthState } from '../auth/authState';
import PageFadeIn from '../components/PageFadeIn';
import { GUIDE } from '../content/guide';
import { readCarArrival } from '../lib/carArrival';

interface AuthViewProps {
  mode: 'sign-in' | 'sign-up';
}

/** Shown in place of the form when no Clerk publishable key is set. */
function SignInUnavailable() {
  return (
    <div className="guide-card auth-page__unavailable" role="status">
      <h2 className="auth-page__unavailable-title">{GUIDE.auth.unavailableTitle}</h2>
      <p>{import.meta.env.DEV ? GUIDE.auth.unavailableDevText : GUIDE.auth.unavailableText}</p>
    </div>
  );
}

/**
 * The log in and sign up pages: a short reason to have an account beside Clerk's form. Signed-in
 * visitors are sent on to the check form.
 */
export default function AuthView({ mode }: AuthViewProps) {
  const { configured, isSignedIn } = useAuthState();
  // A car transition to the check form ends here for signed-out visitors.
  const arrivedByCar = readCarArrival(useLocation().state) !== null;
  const copy = mode === 'sign-in' ? GUIDE.auth.signIn : GUIDE.auth.signUp;

  if (isSignedIn) {
    return <Navigate to={AUTH_PATHS.afterSignIn} replace />;
  }

  let form = <SignInUnavailable />;
  if (configured) {
    form =
      mode === 'sign-in' ? (
        <SignIn
          routing="path"
          path={AUTH_PATHS.signIn}
          signUpUrl={AUTH_PATHS.signUp}
          fallbackRedirectUrl={AUTH_PATHS.afterSignIn}
        />
      ) : (
        <SignUp
          routing="path"
          path={AUTH_PATHS.signUp}
          signInUrl={AUTH_PATHS.signIn}
          fallbackRedirectUrl={AUTH_PATHS.afterSignIn}
        />
      );
  }

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
