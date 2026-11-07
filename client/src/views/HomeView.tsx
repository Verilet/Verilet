import { RatingChip } from '../components/Chip';
import ListingForm from '../components/ListingForm';
import { formatScanDate, scanShortTitle } from '../lib/format';
import { ratingFromScore } from '../lib/risk';
import type { ListingInput, ScanResult } from '../types';

interface HomeViewProps {
  scans: ScanResult[];
  onSubmit: (input: ListingInput) => void;
  submitting: boolean;
  submitError: string | null;
  onViewScan: (scanId: string) => void;
  onViewAll: () => void;
}

const RECENT_COUNT = 4;

/** Screen 4: Home (logged in) with the form and recent scans. */
export default function HomeView({
  scans,
  onSubmit,
  submitting,
  submitError,
  onViewScan,
  onViewAll,
}: HomeViewProps) {
  const recent = scans.slice(0, RECENT_COUNT);

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
          <ListingForm onSubmit={onSubmit} submitting={submitting} submitError={submitError} />
        </section>

        <section className="card card--recent" aria-labelledby="recent-heading">
          <div className="card__header">
            <h2 className="card__heading" id="recent-heading">
              Recent scans
            </h2>
            <button type="button" className="text-button" onClick={onViewAll}>
              View all
            </button>
          </div>
          {recent.length === 0 ? (
            <p className="empty">No scans yet. Check a listing and it will show up here.</p>
          ) : (
            <ul className="recent-list">
              {recent.map((scan) => (
                <li key={scan.id} className="recent-list__item">
                  <button type="button" className="recent-row" onClick={() => onViewScan(scan.id)}>
                    <span className="recent-row__text">
                      <span className="recent-row__title">{scanShortTitle(scan)}</span>
                      <span className="recent-row__date">{formatScanDate(scan.createdAt)}</span>
                    </span>
                    <RatingChip rating={ratingFromScore(scan.score)} />
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
