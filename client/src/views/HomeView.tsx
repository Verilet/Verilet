import { useMemo } from 'react';
import { RatingChip } from '../components/Chip';
import ListingForm from '../components/ListingForm';
import type { CarArrivalInfo } from '../lib/carArrival';
import { formatScanDate, scanShortTitle } from '../lib/format';
import { ratingFromScore } from '../lib/risk';
import type { ListingInput, ScanResult } from '../types';

/** Props for the signed-in home page. */
interface HomeViewProps {
  /** The visitor's scans, newest first. */
  scans: ScanResult[];
  /** Called with the validated form values. */
  onSubmit: (input: ListingInput) => void;
  /** Whether a check is running. */
  submitting: boolean;
  /** Error from the last check, shown on the form. */
  submitError: string | null;
  /** Set when the visitor arrives through a car transition. */
  carArrival?: CarArrivalInfo | null;
  /** Opens one scan's result. */
  onViewScan: (scanId: string) => void;
  /** Opens My scans. */
  onViewAll: () => void;
}

/** How many recent scans the home page lists. */
const RECENT_COUNT = 4;

/**
 * The signed-in home page, with the listing form and recent scans.
 *
 * @param props The page's props.
 * @returns The home page.
 */
export default function HomeView({
  scans,
  onSubmit,
  submitting,
  submitError,
  carArrival,
  onViewScan,
  onViewAll,
}: HomeViewProps) {
  // Titles, dates and ratings are only worked out again when the scans change.
  const recent = useMemo(
    () =>
      scans.slice(0, RECENT_COUNT).map((scan) => ({
        scan,
        title: scanShortTitle(scan),
        date: formatScanDate(scan.createdAt),
        rating: ratingFromScore(scan.score),
      })),
    [scans],
  );

  return (
    <main className="main">
      <div className="page-title">
        <h1 className="page-title__heading">Welcome back</h1>
        <p className="page-title__text">Check a new listing or review your recent scans.</p>
      </div>
      <div className="home-content">
        <section className="card card--home-form" aria-labelledby="home-check-heading">
          <h2 className="card__heading" id="home-check-heading">
            Check a listing
          </h2>
          <ListingForm
            onSubmit={onSubmit}
            submitting={submitting}
            submitError={submitError}
            carArrival={carArrival}
          />
        </section>

        <section className="card card--recent" aria-labelledby="recent-heading">
          <div className="card__header">
            <h2 className="card__heading" id="recent-heading">
              Recent scans
            </h2>
            {recent.length > 0 && (
              <button type="button" className="text-button" onClick={onViewAll}>
                View all
              </button>
            )}
          </div>
          {recent.length === 0 ? (
            <p className="empty">No scans yet. Check a listing and it will show up here.</p>
          ) : (
            <ul className="recent-list">
              {recent.map(({ scan, title, date, rating }) => (
                <li key={scan.id} className="recent-list__item">
                  <button type="button" className="recent-row" onClick={() => onViewScan(scan.id)}>
                    <span className="recent-row__text">
                      <span className="recent-row__title">{title}</span>
                      <span className="recent-row__date">{date}</span>
                    </span>
                    <RatingChip rating={rating} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
