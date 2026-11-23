import { clerkMiddleware, getAuth } from '@clerk/express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Answers 503 when the Clerk keys aren't set, so routes that need sign-in fail clearly instead of
 * crashing on every request.
 *
 * @param _req The request.
 * @param res The response.
 * @param next Continues to the next handler.
 * @returns The 503 response, or nothing when the keys are set.
 */
export function requireClerkConfig(_req: Request, res: Response, next: NextFunction) {
  if (!process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY) {
    return res
      .status(503)
      .json({ success: false, error: 'Sign-in is not configured on the server.' });
  }
  next();
}

/** Clerk's middleware, created on first use so it only starts once the keys are known to be set. */
let clerk: RequestHandler | undefined;

/**
 * Reads the Clerk session token sent with the request.
 *
 * @param req The request.
 * @param res The response.
 * @param next Continues to the next handler.
 * @returns Whatever Clerk's middleware returns.
 */
export function clerkSession(req: Request, res: Response, next: NextFunction) {
  clerk ??= clerkMiddleware();
  return clerk(req, res, next);
}

/**
 * Answers 401 unless the request comes from a signed-in Clerk user, and otherwise puts their user
 * ID in `res.locals.userId` for the handlers after it.
 *
 * @param req The request, after `clerkSession`.
 * @param res The response.
 * @param next Continues to the next handler.
 * @returns The 401 response, or nothing when someone is signed in.
 */
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Log in to continue.' });
  }
  res.locals.userId = userId;
  next();
}
