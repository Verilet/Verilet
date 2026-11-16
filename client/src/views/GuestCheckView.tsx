import ListingForm from '../components/ListingForm';
import { GUIDE } from '../content/guide';
import type { CarArrivalInfo } from '../lib/carArrival';
import type { ListingInput } from '../types';

interface GuestCheckViewProps {
  onSubmit: (input: ListingInput) => void;
  submitting: boolean;
  submitError: string | null;
  /** Set when the visitor arrives through a car transition. */
  carArrival?: CarArrivalInfo | null;
}

/** The listing form for visitors without an account. Their result isn't saved. */
export default function GuestCheckView({
  onSubmit,
  submitting,
  submitError,
  carArrival,
}: GuestCheckViewProps) {
  return (
    <main className="main main--center">
      <div className="intro">
        <h1 className="intro__title">{GUIDE.guest.formTitle}</h1>
        <p className="intro__text">{GUIDE.guest.formText}</p>
      </div>
      <section className="card card--form" aria-label="Check a listing">
        <ListingForm
          onSubmit={onSubmit}
          submitting={submitting}
          submitError={submitError}
          carArrival={carArrival}
        />
      </section>
      <p className="footnote">{GUIDE.footnote}</p>
    </main>
  );
}
