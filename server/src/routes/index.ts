import { Router } from 'express';
import checkRoutes from './check.routes.js';
import healthRoutes from './health.routes.js';
import scansRoutes from './scans.routes.js';
import scrapeRoutes from './scrape.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/scrape', scrapeRoutes);
router.use('/scans', scansRoutes);
router.use('/check', checkRoutes);

export default router;
