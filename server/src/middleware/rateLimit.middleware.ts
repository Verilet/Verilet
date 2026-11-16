import rateLimit from 'express-rate-limit';

/** How many guest checks one address can make per hour. Signed-in checks aren't limited here. */
export const GUEST_CHECKS_PER_HOUR = 30;

/** Limits the guest check, which anyone can call without an account. Answers 429 when over. */
export const guestCheckLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: GUEST_CHECKS_PER_HOUR,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  statusCode: 429,
  message: {
    success: false,
    error:
      'Too many checks from this connection. Try again in an hour, or log in to keep checking.',
  },
});
