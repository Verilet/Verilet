import { type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { type ZodSchema } from 'zod';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '169.254.169.254',
  '[::1]',
]);

/**
 * Express middleware to validate the incoming scrape request URL.
 * Rejects missing, malformed, non-HTTP/HTTPS, or loopback/private URLs with HTTP 400.
 *
 * @param req Express request object containing `req.body.url`
 * @param res Express response object used to return 400 errors
 * @param next Express next middleware function
 */
export function validateScrapeRequest(req: Request, res: Response, next: NextFunction): void {
  const url: unknown = req.body?.url;
  if (typeof url !== 'string' || !url.trim()) {
    res.status(400).json({ error: 'Invalid listing URL' });
    return;
  }

  let parsedUrl: URL;

  // Check for empty or undefined or malformed url
  try {
    parsedUrl = new URL(url);
  } catch {
    res.status(400).json({ error: 'Invalid listing URL' });
    return;
  }

  // Check for non-HTTP/HTTPS protocols
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    res.status(400).json({ error: 'Invalid listing URL' });
    return;
  }

  // Check for loopback or private IPs
  const hostname = parsedUrl.hostname.toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    res.status(400).json({ error: 'Invalid listing URL' });
    return;
  }

  next();
}

/**
 * Express middleware factory that validates `req.body` against a given Zod schema.
 * Rejects invalid payloads with HTTP 400 and a standardized error envelope.
 *
 * @param schema Zod schema to parse req.body with
 * @returns Express RequestHandler middleware function
 */
export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.format(),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
