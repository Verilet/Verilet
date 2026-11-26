import { z } from 'zod';
import { CHECK_STATUS_VALUES, type Rating } from '../types';

/** Zod schema validating an individual normalized diagnostic check finding. */
export const scanCheckSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  status: z.enum(CHECK_STATUS_VALUES),
  scoreImpact: z.number().min(0),
  evidence: z.string().nullable(),
});

/**
 * Verifies that a composite score (`number | null`) agrees with its categorical rating
 * (`INSUFFICIENT_DATA` iff `score === null`).
 *
 * @param data Object containing `score` and `rating`.
 * @returns True when `score === null` matches `rating === 'INSUFFICIENT_DATA'`.
 */
export function isScoreRatingConsistent(data: { score: number | null; rating: Rating }): boolean {
  return (data.score === null) === (data.rating === 'INSUFFICIENT_DATA');
}
