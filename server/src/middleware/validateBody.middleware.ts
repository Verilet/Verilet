import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

/**
 * Builds middleware that checks `req.body` with a Zod schema before the handler runs. A valid body
 * is replaced with the parsed value; an invalid one gets a 400 naming the fields that failed.
 *
 * @param schema What a valid body looks like.
 * @returns The middleware.
 */
export function validateBody(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Some details are missing or invalid.',
        details: z.flattenError(parsed.error),
      });
    }
    req.body = parsed.data;
    next();
  };
}
