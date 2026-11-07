import ListingForm from '../components/ListingForm';
import type { ListingInput } from '../types';

interface CheckViewProps {
  onSubmit: (input: ListingInput) => void;
  submitting: boolean;
  submitError: string | null;
}

/** Screen 1: "Check a listing" (logged out). */
export default function CheckView({ onSubmit, submitting, submitError }: CheckViewProps) {
  return (
    <main className="main main--center">
      <div className="intro">
        <h1 className="intro__title">Check a rental listing before you pay</h1>
        <p className="intro__text">
          Paste a link and add a few details. Verilet checks the listing for common scam signals.
        </p>
      </div>
      <section className="card card--form" aria-label="Check a listing">
        <ListingForm onSubmit={onSubmit} submitting={submitting} submitError={submitError} />
      </section>
      <p className="footnote">Verilet gives a risk rating, not a guarantee.</p>
    </main>
  );
}
