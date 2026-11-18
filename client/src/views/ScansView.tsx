import { useState } from 'react';
import { RatingChip } from '../components/Chip';
import { formatScanDate, listingHost, scanTitle } from '../lib/format';
import { ratingFromScore, ratingTone } from '../lib/risk';
import type { Rating, ScanResult } from '../types';

/** Which ratings the table shows. */
type Filter = 'ALL' | Rating;

/** Props for the My scans page. */
interface ScansViewProps {
  /** The visitor's scans, newest first. */
  scans: ScanResult[];
  /** Opens one scan's result. */
  onViewScan: (scanId: string) => void;
  /** Copies a short summary of a scan. */
  onShareScan: (scan: ScanResult) => void;
  /** Outcome of the most recent share attempt, for brief feedback on that row. */
  shareStatus: { id: string; ok: boolean } | null;
}

/** The rating filter buttons above the table. */
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'HIGH', label: 'High risk' },
  { value: 'MEDIUM', label: 'Medium risk' },
  { value: 'LOW', label: 'Low risk' },
];

/**
 * The signed-in table of past scans, with rating filters.
 *
 * @param props The page's props.
 * @returns The My scans page.
 */
export default function ScansView({ scans, onViewScan, onShareScan, shareStatus }: ScansViewProps) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const visible =
    filter === 'ALL' ? scans : scans.filter((scan) => ratingFromScore(scan.score) === filter);

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
                  LISTING
                </th>
                <th scope="col" className="col-rating">
                  RATING
                </th>
                <th scope="col" className="col-score">
                  SCORE
                </th>
                <th scope="col" className="col-date">
                  DATE
                </th>
                <th scope="col" className="col-actions">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((scan) => {
                const rating = ratingFromScore(scan.score);
                return (
                  <tr key={scan.id}>
                    <td className="col-listing">
                      <span className="scans-table__title">{scanTitle(scan)}</span>
                      <span className="scans-table__sub">{listingHost(scan.listingUrl)}</span>
                    </td>
                    <td className="col-rating">
                      <RatingChip rating={rating} />
                    </td>
                    <td className={`col-score score score--${ratingTone(scan.score)}`}>
                      {scan.score}
                    </td>
                    <td className="col-date">{formatScanDate(scan.createdAt)}</td>
                    <td className="col-actions">
                      <button
                        type="button"
                        className="row-action row-action--strong"
                        onClick={() => onViewScan(scan.id)}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="row-action"
                        onClick={() => onShareScan(scan)}
                      >
                        {shareStatus?.id === scan.id
                          ? shareStatus.ok
                            ? 'Copied'
                            : "Couldn't copy"
                          : 'Share'}
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
