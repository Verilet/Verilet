import { Link } from 'react-router-dom';
import { AUTH_PATHS } from '../auth/authState';
import { RatingChip } from '../components/Chip';
import { GUIDE } from '../content/guide';
import { bedroomLabel, formatRent } from '../lib/format';
import { RATING_HEADLINE, ratingFromScore } from '../lib/risk';
import type { GuestCheck } from '../schemas/scan';

interface GuestResultViewProps {
  check: GuestCheck;
  onCheckAnother: () => void;
}

/**
 * The short result for a guest: the rating, the advice, and every red flag. Warnings are never
 * held back; signing in adds the full breakdown and saves the check.
 */
export default function GuestResultView({ check, onCheckAnother }: GuestResultViewProps) {
  const rating = ratingFromScore(check.score);
  const headline = RATING_HEADLINE[rating];
  const flags = check.checks.filter((item) => item.status === 'FLAG');
  const { listing } = check;

  return (
    <main className="main main--center">
      <div className="results">
        <section className="card card--summary" aria-labelledby="result-heading">
          <div className="summary__meta">
            <p>
              {bedroomLabel(listing.bedrooms)} · {formatRent(listing.rent)} / month ·{' '}
              {listing.location}
            </p>
          </div>
          <RatingChip rating={rating} />
          <h1 className="summary__title" id="result-heading">
            {headline.title}
          </h1>
          <p className="summary__advice">{headline.advice}</p>

          <div className="guest-flags">
            <h2 className="details__heading">{GUIDE.guest.flagsHeading}</h2>
            {flags.length === 0 ? (
              <p className="guest-flags__none">{GUIDE.guest.noFlags}</p>
            ) : (
              <ul className="guest-flags__list">
                {flags.map((flag) => (
                  <li key={flag.id} className="guest-flags__item">
                    <span className="chip chip--danger">FLAG</span>
                    <span>{flag.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="card guest-cta" aria-labelledby="guest-cta-heading">
          <h2 className="guest-cta__title" id="guest-cta-heading">
            {GUIDE.guest.ctaTitle}
          </h2>
          <p className="guest-cta__text">{GUIDE.guest.ctaText}</p>
          <div className="actions">
            <Link to={AUTH_PATHS.signIn} className="button button--primary">
              {GUIDE.auth.logInLabel}
            </Link>
            <Link to={AUTH_PATHS.signUp} className="button button--secondary">
              {GUIDE.guest.signUpLabel}
            </Link>
          </div>
        </section>

        <button type="button" className="button button--secondary" onClick={onCheckAnother}>
          Check another listing
        </button>
        <p className="footnote footnote--left">{GUIDE.disclaimer}</p>
      </div>
    </main>
  );
}
