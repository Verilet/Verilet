import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RatingChip, StatusChip } from '../components/Chip';
import { scanMeta } from '../lib/format';
import { RATING_HEADLINE, ratingFromScore, ratingTone } from '../lib/risk';
import { readSharedScan } from '../lib/shareLink';
import '../styles/results.css';

/**
 * A result someone shared, opened from a share link. It is read-only: the details are always
 * shown, and there is nothing to share or save. A broken link gets an explanation instead.
 *
 * @returns The shared result, or a message that the link doesn't work.
 */
export default function SharedResultView() {
  const { data = '' } = useParams();
  const scan = useMemo(() => readSharedScan(data), [data]);

  if (!scan) {
    return (
      <main className="main main--center">
        <div className="intro">
          <h1 className="intro__title">This share link doesn&rsquo;t work</h1>
          <p className="intro__text">
            It may have been cut off when it was copied. Ask for the link again.
          </p>
          <Link to="/check" className="button button--primary">
            Check a listing
          </Link>
        </div>
      </main>
    );
  }

  const rating = ratingFromScore(scan.score);
  const headline = RATING_HEADLINE[rating];
  const tone = ratingTone(scan.score);

  return (
    <main className="main main--center">
      <div className="results">
        <section className="card card--summary" aria-labelledby="shared-heading">
          <p className="summary__shared">
            Someone shared this result with you. Check a listing yourself before sending money.
          </p>
          <div className="summary__meta">
            <p>{scanMeta(scan)}</p>
          </div>
          <RatingChip rating={rating} />
          <h1 className="summary__title" id="shared-heading">
            {headline.title}
          </h1>
          <p className="summary__advice">{headline.advice}</p>
          <div className="actions">
            <Link to="/check" className="button button--primary">
              Check your own listing
            </Link>
          </div>
        </section>

        <section className="card card--details" aria-label="Result details">
          <p className="details__label">Risk score</p>
          <p className="score-figure">
            <span className={`score-figure__value score--${tone}`}>{scan.score}</span>
            <span className="score-figure__max">/ 100</span>
          </p>
          <div
            className="score-bar"
            role="meter"
            aria-label="Risk score"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={scan.score}
          >
            <div
              className={`score-bar__fill score-bar__fill--${tone}`}
              style={{ width: `${scan.score}%` }}
            />
          </div>
          <div className="score-scale">
            <span>0 · Low risk</span>
            <span>High risk · 100</span>
          </div>
          <hr className="divider" />
          <h2 className="details__heading">What we checked</h2>
          <ul className="checks">
            {scan.checks.map((check) => (
              <li key={check.id} className="check">
                <div className="check__text">
                  <span className="check__title">{check.title}</span>
                  <span className="check__detail">{check.detail}</span>
                </div>
                <StatusChip status={check.status} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
