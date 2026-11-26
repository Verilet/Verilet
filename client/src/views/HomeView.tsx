import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { RatingChip } from '../components/Chip';
import ListingForm from '../components/ListingForm';
import type { CarArrivalInfo } from '../lib/carArrival';
import { formatScanDate, scanShortTitle } from '../lib/format';
import type { ListingInput, ScanResult } from '../types';
import '../styles/home.css';

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
}: HomeViewProps) {
  // Titles, dates and ratings are only worked out again when the scans change.
  const recent = useMemo(
    () =>
      scans.slice(0, RECENT_COUNT).map((scan) => ({
        scan,
        title: scanShortTitle(scan),
        date: formatScanDate(scan.createdAt),
        rating: scan.rating,
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
            {/* Only worth linking to My scans when it holds more than this card shows. */}
            {scans.length > RECENT_COUNT && (
              <Link to="/scans" className="text-button">
                View all
              </Link>
            )}
          </div>
          {recent.length === 0 ? (
            <p className="empty">No scans yet. Check a listing and it will show up here.</p>
          ) : (
            <ul className="recent-list">
              {recent.map(({ scan, title, date, rating }) => (
                <li key={scan.id} className="recent-list__item">
                  <Link to={`/results/${scan.id}`} className="recent-row">
                    <span className="recent-row__text">
                      <span className="recent-row__title">{title}</span>
                      <span className="recent-row__date">{date}</span>
                    </span>
                    <RatingChip rating={rating} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
