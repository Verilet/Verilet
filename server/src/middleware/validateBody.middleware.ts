import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

/** Validates `req.body` with a Zod schema, replacing it with the parsed value or answering 400. */
export function validateBody(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Some listing details are missing or invalid.',
        details: z.flattenError(parsed.error),
      });
    }
    req.body = parsed.data;
    next();
  };
}
