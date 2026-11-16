import { clerkMiddleware, getAuth } from '@clerk/express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Answers 503 when the Clerk keys are missing, instead of failing on every request. */
export function requireClerkConfig(_req: Request, res: Response, next: NextFunction) {
  if (!process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY) {
    return res
      .status(503)
      .json({ success: false, error: 'Sign-in is not configured on the server.' });
  }
  next();
}

let clerk: RequestHandler | undefined;

/** Reads the Clerk session from the request. Created on first use, after the keys are checked. */
export function clerkSession(req: Request, res: Response, next: NextFunction) {
  clerk ??= clerkMiddleware();
  return clerk(req, res, next);
}

/** Answers 401 unless the request has a signed-in Clerk user, whose ID goes in `res.locals.userId`. */
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Log in to continue.' });
  }
  res.locals.userId = userId;
  next();
}
