import type { Rating } from '../types';

/** The rating band for a 0 to 100 risk score. */
export function ratingFromScore(score: number): Rating {
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

/** The text shown on each rating chip. */
export const RATING_LABEL: Record<Rating, string> = {
  HIGH: 'HIGH RISK',
  MEDIUM: 'MEDIUM RISK',
  LOW: 'LOW RISK',
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
};

/** The colour families used for ratings and scores. */
export type Tone = 'danger' | 'warn' | 'ok' | 'neutral';

/** The colour family for each rating. */
export const RATING_TONE: Record<Rating, Tone> = { HIGH: 'danger', MEDIUM: 'warn', LOW: 'ok' };

/** The colour family for a score, used for the score number and bar. */
export function ratingTone(score: number): Tone {
  return RATING_TONE[ratingFromScore(score)];
}
