import type { ReactElement } from 'react';
import { RATING_LABEL, RATING_TONE, type Tone } from '../lib/risk';
import type { CheckStatus, Rating } from '../types';

/** Maps each normalized diagnostic check status to its pill badge color tone. */
const STATUS_TONE: Record<CheckStatus, Tone> = {
  FLAG: 'danger',
  UNKNOWN: 'neutral',
  OK: 'ok',
  SKIPPED: 'neutral',
};

/** Props for the {@link RatingChip} component. */
export interface RatingChipProps {
  /** Categorical risk rating tier to display. */
  rating: Rating;
}

/** Props for the {@link StatusChip} component. */
export interface StatusChipProps {
  /** Normalized diagnostic check status to display. */
  status: CheckStatus;
}

/**
 * Renders a colored pill badge representing an overall listing risk rating.
 *
 * @param props Component props containing the listing rating.
 * @returns Styled rating chip element.
 */
export function RatingChip({ rating }: RatingChipProps): ReactElement {
  return <span className={`chip chip--${RATING_TONE[rating]}`}>{RATING_LABEL[rating]}</span>;
}

/**
 * Renders a colored pill badge representing an individual diagnostic check status.
 *
 * @param props Component props containing the check status.
 * @returns Styled status chip element.
 */
export function StatusChip({ status }: StatusChipProps): ReactElement {
  return <span className={`chip chip--${STATUS_TONE[status]}`}>{status}</span>;
}
