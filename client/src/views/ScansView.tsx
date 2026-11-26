import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RatingChip } from '../components/Chip';
import { formatScanDate, listingHost, scanTitle } from '../lib/format';
import { RATING_TONE } from '../lib/risk';
import { shareButtonLabel, type ShareStatus } from '../lib/share';
import '../styles/scans.css';
import type { Rating, ScanResult } from '../types';

/** Which ratings the table shows. */
type Filter = 'ALL' | Rating;

/** One table row, with everything it shows worked out once. */
interface ScanRow {
  /** The scan behind the row. */
  scan: ScanResult;
  /** Its risk rating. */
  rating: Rating;
  /** e.g. "2 bed · $1,200 · Santa Cruz, CA". */
  title: string;
  /** The website the listing is on, e.g. "zillow.com". */
  host: string;
  /** e.g. "Today" or "Oct 15". */
  date: string;
}

/**
 * Works out each scan's rating, title, website and date once.
 *
 * @param scans The visitor's scans.
 * @returns One row per scan, in the same order.
 */
function toRows(scans: ScanResult[]): ScanRow[] {
  return scans.map((scan) => ({
    scan,
    rating: scan.rating,
    title: scanTitle(scan),
    host: listingHost(scan.listingUrl),
    date: formatScanDate(scan.createdAt),
  }));
}

/** Props for the My scans page. */
interface ScansViewProps {
  /** The visitor's scans, newest first. */
  scans: ScanResult[];
  /** Copies a short summary of a scan. */
  onShareScan: (scan: ScanResult) => void;
  /** Outcome of the most recent share attempt, for brief feedback on that row. */
  shareStatus: ShareStatus | null;
}

/** One rating filter button. */
interface FilterOption {
  /** The rating it shows, or every rating. */
  value: Filter;
  /** The button's text. */
  label: string;
}

/** The rating filter buttons above the table. */
const FILTERS: FilterOption[] = [
  { value: 'ALL', label: 'All' },
  { value: 'HIGH', label: 'High risk' },
  { value: 'MEDIUM', label: 'Medium risk' },
  { value: 'LOW', label: 'Low risk' },
];

/**
 * The signed-in table of past scans, with rating filters. On phones each row becomes a card, so
 * the page never scrolls sideways.
 *
 * @param props The page's props.
 * @returns The My scans page.
 */
export default function ScansView({ scans, onShareScan, shareStatus }: ScansViewProps) {
  const [filter, setFilter] = useState<Filter>('ALL');
  // Rows are only rebuilt when the scans change, and only re-filtered when the filter changes.
  const rows = useMemo(() => toRows(scans), [scans]);
  const visible = useMemo(
    () => (filter === 'ALL' ? rows : rows.filter((row) => row.rating === filter)),
    [rows, filter],
  );
  const sharedTitle = rows.find((row) => row.scan.id === shareStatus?.id)?.title;

  return (
    <main className="main">
      <div className="page-title">
        <h1 className="page-title__heading">My scans</h1>
        <p className="page-title__text">Every listing you have checked, newest first.</p>
      </div>

      <div className="filters" role="group" aria-label="Filter by risk rating">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="filter"
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
          >
            {option.value === 'ALL' ? `${option.label} (${scans.length})` : option.label}
          </button>
        ))}
      </div>

      {/* Tells screen readers whether a copy worked; the button text changes for sighted users. */}
      <p className="visually-hidden" aria-live="polite">
        {shareStatus && sharedTitle
          ? `${shareStatus.ok ? 'Copied' : "Couldn't copy"} the result for ${sharedTitle}`
          : ''}
      </p>

      {scans.length === 0 ? (
        <p className="empty empty--panel">You haven&rsquo;t checked any listings yet.</p>
      ) : visible.length === 0 ? (
        <p className="empty empty--panel">No scans with this rating.</p>
      ) : (
        <div className="table-card">
          <table className="scans-table">
            <thead>
              <tr>
                <th scope="col" className="col-listing">
                  Listing
                </th>
                <th scope="col" className="col-rating">
                  Rating
                </th>
                <th scope="col" className="col-score">
                  Score
                </th>
                <th scope="col" className="col-date">
                  Date
                </th>
                <th scope="col" className="col-actions">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ scan, rating, title, host, date }) => {
                const shareLabel = shareButtonLabel(scan.id, shareStatus, 'Share');
                return (
                  <tr key={scan.id}>
                    <td className="col-listing">
                      <span className="scans-table__title">{title}</span>
                      {host && <span className="scans-table__sub">{host}</span>}
                    </td>
                    <td className="col-rating">
                      <RatingChip rating={rating} />
                    </td>
                    <td className="col-score">
                      <span className={`score score--${RATING_TONE[rating]}`}>
                        {scan.score ?? '—'}
                      </span>
                    </td>
                    <td className="col-date">{date}</td>
                    <td className="col-actions">
                      <Link
                        to={`/results/${scan.id}`}
                        className="row-action row-action--strong"
                        aria-label={`View result for ${title}`}
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        className="row-action"
                        aria-label={`${shareLabel} result for ${title}`}
                        onClick={() => onShareScan(scan)}
                      >
                        {shareLabel}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
