import { useId, useState } from 'react';
import ChevronIcon from '../components/ChevronIcon';
import { RatingChip, StatusChip } from '../components/Chip';
import { scanMeta } from '../lib/format';
import { RATING_HEADLINE, ratingFromScore, ratingTone } from '../lib/risk';
import type { ScanResult } from '../types';

interface ResultsViewProps {
  scan: ScanResult;
  loggedIn: boolean;
  backLabel: string;
  onBack: () => void;
  onCheckAnother: () => void;
  onShare: () => void;
  shareLabel: string;
  /** Whether "More details" starts open. */
  defaultExpanded: boolean;
}

/** Screens 2, 3 and 6: results, with and without the "More details" panel. */
export default function ResultsView({
  scan,
  loggedIn,
  backLabel,
  onBack,
  onCheckAnother,
  onShare,
  shareLabel,
  defaultExpanded,
}: ResultsViewProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const detailsId = useId();
  const rating = ratingFromScore(scan.score);
  const headline = RATING_HEADLINE[rating];

  return (
    <main className="main main--center">
      <div className="results">
        <button type="button" className="back-link" onClick={onBack}>
          {backLabel}
        </button>

        <section className="card card--summary" aria-labelledby="result-heading">
          <div className="summary__meta">
            <p>{scanMeta(scan)}</p>
            {loggedIn && <p className="summary__saved">Saved to My scans</p>}
          </div>
          <RatingChip rating={rating} />
          <h1 className="summary__title" id="result-heading">
            {headline.title}
          </h1>
          <p className="summary__advice">{headline.advice}</p>
          <div className="actions">
            <button
              type="button"
              className="button button--primary"
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? 'Hide details' : 'More details'}
              <ChevronIcon up={expanded} />
            </button>
            {loggedIn && (
              <button type="button" className="button button--secondary" onClick={onShare}>
                {shareLabel}
              </button>
            )}
            <button type="button" className="button button--secondary" onClick={onCheckAnother}>
              Check another listing
            </button>
          </div>
        </section>

        <section
          id={detailsId}
          className="card card--details"
          hidden={!expanded}
          aria-label="Result details"
        >
          <p className="details__label">Risk score</p>
          <p className="score-figure">
            <span className={`score-figure__value score--${ratingTone(scan.score)}`}>
              {scan.score}
            </span>
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
              className={`score-bar__fill score-bar__fill--${ratingTone(scan.score)}`}
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

        <p className="footnote footnote--left">
          Verilet gives a risk rating, not a guarantee. Always verify in person before sending
          money.
        </p>
      </div>
    </main>
  );
}
