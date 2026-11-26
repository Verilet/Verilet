import type { Rating, ScanResult } from '../types';

/**
 * Returns true when a scan could not be scored due to insufficient evaluable checks.
 *
 * @param scan Scan result or partial score/rating pair to check.
 * @returns True when rating is `INSUFFICIENT_DATA` or score is `null`.
 */
export function isInsufficientScan(scan: Pick<ScanResult, 'rating' | 'score'>): boolean {
  return scan.rating === 'INSUFFICIENT_DATA' || scan.score === null;
}

/**
 * Maps a numeric 0–100 score to its categorical rating tier, or `INSUFFICIENT_DATA` when `null`.
 *
 * @param score Numeric risk score from 0 to 100, or `null` when fewer than 3 checks evaluated.
 * @returns Categorical risk rating tier.
 */
export function ratingFromScore(score: number | null): Rating {
  if (score === null) {
    return 'INSUFFICIENT_DATA';
  }
  if (score >= 70) {
    return 'HIGH';
  }
  if (score >= 40) {
    return 'MEDIUM';
  }
  return 'LOW';
}

/** The text shown on each rating chip. */
export const RATING_LABEL: Record<Rating, string> = {
  HIGH: 'HIGH RISK',
  MEDIUM: 'MEDIUM RISK',
  LOW: 'LOW RISK',
  INSUFFICIENT_DATA: 'INSUFFICIENT DATA',
};

/** The results page heading and advice for each rating. */
export const RATING_HEADLINE: Record<Rating, { title: string; advice: string }> = {
  HIGH: {
    title: 'This listing shows several scam signals',
    advice:
      "Don't send money or share personal information until you've verified the listing and the landlord.",
  },
  MEDIUM: {
    title: 'This listing has some warning signs',
    advice: 'Verify the landlord and the property in person before you send any money.',
  },
  LOW: {
    title: 'This listing looks low risk',
    advice:
      'We found no major scam signals, but still verify the listing and landlord before you pay.',
  },
  INSUFFICIENT_DATA: {
    title: "We couldn't verify enough checks to score this listing",
    advice:
      "We weren't able to run enough checks to calculate a reliable risk score. Try adding more listing details—such as a full street address with ZIP code, deposit, fee, phone number, or description—so we can check more signals.",
  },
};

/** The colour families used for ratings and scores. */
export type Tone = 'danger' | 'warn' | 'ok' | 'neutral';

/** The colour family for each rating. */
export const RATING_TONE: Record<Rating, Tone> = {
  HIGH: 'danger',
  MEDIUM: 'warn',
  LOW: 'ok',
  INSUFFICIENT_DATA: 'neutral',
};
