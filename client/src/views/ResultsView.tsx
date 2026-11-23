import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import ChevronIcon from '../components/ChevronIcon';
import { RatingChip, StatusChip } from '../components/Chip';
import { GUIDE } from '../content/guide';
import { scanMeta } from '../lib/format';
import { RATING_HEADLINE, ratingFromScore, ratingTone } from '../lib/risk';
import type { ScanResult } from '../types';
import '../styles/results.css';

/** Props for the results page. */
interface ResultsViewProps {
  /** The scan to show. */
  scan: ScanResult;
  /** Text of the back link, e.g. "← My scans". */
  backLabel: string;
  /** Where the back link goes, e.g. `/scans`. */
  backTo: string;
  /** Copies a short summary of the result. */
  onShare: () => void;
  /** Text of the share button, which briefly confirms a copy. */
  shareLabel: string;
  /** Whether "More details" starts open. */
  defaultExpanded: boolean;
}

/**
 * The result of a check, with an expandable "More details" panel and a share button.
 *
 * @param props The page's props.
 * @returns The results page.
 */
export default function ResultsView({
  scan,
  backLabel,
  backTo,
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
        <Link to={backTo} className="back-link">
          {backLabel}
        </Link>

        <section className="card card--summary" aria-labelledby="result-heading">
          <div className="summary__meta">
            <p>{scanMeta(scan)}</p>
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
            <button type="button" className="button button--secondary" onClick={onShare}>
              {shareLabel}
            </button>
            <Link to="/check" className="button button--secondary">
              Check another listing
            </Link>
          </div>
          {/* Tells screen readers whether the copy worked; the button text changes for sighted users. */}
          <p className="visually-hidden" aria-live="polite">
            {shareLabel === 'Share result' ? '' : shareLabel}
          </p>
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
          <hr className="divider" />
          <h2 className="details__heading">{GUIDE.legendHeading}</h2>
          <ul className="legend__list">
            {GUIDE.legend.map((item) => (
              <li key={item.label} className="legend__item">
                <span className={`chip chip--${item.tone}`}>{item.label}</span>
                <span className="legend__text">{item.text}</span>
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
