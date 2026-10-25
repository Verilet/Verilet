import { Router } from 'express';
import healthRoutes from './health.routes.js';
import scrapeRoutes from './scrape.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/scrape', scrapeRoutes);

export default router;
