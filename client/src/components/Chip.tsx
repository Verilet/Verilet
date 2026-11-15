import { RATING_LABEL, RATING_TONE, type Tone } from '../lib/risk';
import type { CheckStatus, Rating } from '../types';

const STATUS_TONE: Record<CheckStatus, Tone> = { FLAG: 'danger', UNKNOWN: 'neutral', OK: 'ok' };

export function RatingChip({ rating }: { rating: Rating }) {
  return <span className={`chip chip--${RATING_TONE[rating]}`}>{RATING_LABEL[rating]}</span>;
}

export function StatusChip({ status }: { status: CheckStatus }) {
  return <span className={`chip chip--${STATUS_TONE[status]}`}>{status}</span>;
}
