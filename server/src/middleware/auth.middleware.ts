import { clerkMiddleware, getAuth } from '@clerk/express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

/**
 * The Clerk keys from the environment. Spaces around a key, as can slip into an `.env` file, are
 * trimmed; a missing, blank or wrong-kind key fails.
 */
const clerkKeysSchema = z.object({
  CLERK_SECRET_KEY: z
    .string()
    .trim()
    .regex(/^sk_(test|live)_\S+$/),
  CLERK_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .regex(/^pk_(test|live)_\S+$/),
});

/** The checked Clerk keys. */
type ClerkKeys = z.infer<typeof clerkKeysSchema>;

/** A signed-in user's Clerk ID, as `requireUser` stores it in `res.locals.userId`. */
const userIdSchema = z.string().min(1);

/**
 * Reads the Clerk keys from the environment.
 *
 * @returns The trimmed keys, or null when either is missing or invalid.
 */
function readClerkKeys(): ClerkKeys | null {
  const result = clerkKeysSchema.safeParse(process.env);
  return result.success ? result.data : null;
}

let clerk: RequestHandler | undefined;

/**
 * Reads the Clerk session token sent with the request, using the checked keys. Answers 503 when
 * the keys aren't set or aren't valid keys, so routes that need sign-in fail clearly instead of
 * crashing on every request.
 *
 * @param req The request.
 * @param res The response.
 * @param next Continues to the next handler.
 */
export function clerkSession(req: Request, res: Response, next: NextFunction): void {
  const keys = readClerkKeys();
  if (!keys) {
    res.status(503).json({ success: false, error: 'Sign-in is not configured on the server.' });
    return;
  }
  clerk ??= clerkMiddleware({
    secretKey: keys.CLERK_SECRET_KEY,
    publishableKey: keys.CLERK_PUBLISHABLE_KEY,
  });
  void clerk(req, res, next);
}

/**
 * Answers 401 unless the request comes from a signed-in Clerk user, and otherwise puts their user
 * ID in `res.locals.userId` for the handlers after it.
 *
 * @param req The request, after `clerkSession`.
 * @param res The response.
 * @param next Continues to the next handler.
 */
export function requireUser(req: Request, res: Response, next: NextFunction): void {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ success: false, error: 'Log in to continue.' });
    return;
  }
  res.locals.userId = userId;
  next();
}

/**
 * The signed-in user's Clerk ID that `requireUser` stored.
 *
 * @param res The response.
 * @returns The user ID.
 * @throws {Error} If `requireUser` didn't run first, so no handler ever reads or writes scans
 *   under a missing ID.
 */
export function signedInUserId(res: Response): string {
  const result = userIdSchema.safeParse(res.locals.userId);
  if (!result.success) {
    throw new Error('No signed-in user: requireUser must run before this handler.');
  }
  return result.data;
}
