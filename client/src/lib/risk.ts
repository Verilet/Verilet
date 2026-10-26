import type { Rating } from '../types';

export function ratingFromScore(score: number): Rating {
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

export const RATING_LABEL: Record<Rating, string> = {
  HIGH: 'HIGH RISK',
  MEDIUM: 'MEDIUM RISK',
  LOW: 'LOW RISK',
};

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

export type Tone = 'danger' | 'warn' | 'ok' | 'neutral';

export const RATING_TONE: Record<Rating, Tone> = { HIGH: 'danger', MEDIUM: 'warn', LOW: 'ok' };

/** Colour tone for a score (used for the score number and bar). */
export function ratingTone(score: number): Tone {
  return RATING_TONE[ratingFromScore(score)];
}
