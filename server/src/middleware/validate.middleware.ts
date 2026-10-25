import { type Request, type Response, type NextFunction } from 'express';

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
 * @param req - Express request object containing `req.body.url`
 * @param res - Express response object used to return 400 errors
 * @param next - Express next middleware function
 */
function validateScrapeRequest(req: Request, res: Response, next: NextFunction) {
  const url: string = req.body?.url;
  let parsedUrl: URL;

  // Check for empty or undefined or malformed url
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid listing URL' });
  }

  // Check for non-HTTP/HTTPS protocols
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return res.status(400).json({ error: 'Invalid listing URL' });
  }

  // Check for loopback or private IPs
  const hostname = parsedUrl.hostname.toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return res.status(400).json({ error: 'Invalid listing URL' });
  }

  next();
}

export default validateScrapeRequest;
