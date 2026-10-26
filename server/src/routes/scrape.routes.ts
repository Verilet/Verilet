import { Router, type Request, type Response } from 'express';
import validateScrapeRequest from '../middleware/validate.middleware.js';
import { scrapeListing } from '../services/scraper.service.js';

const router = Router();

/**
 * POST /api/scrape
 * Validates the incoming listing URL, invokes the scraping engine,
 * and returns the extracted property details or failure envelope.
 */
router.post('/', validateScrapeRequest, async (req: Request, res: Response) => {
  const result = await scrapeListing(req.body.url);
  return res.status(200).json(result);
});

export default router;
