import { Router } from 'express';
import evaluateRoutes from './evaluate.routes.js';
import healthRoutes from './health.routes.js';
import scrapeRoutes from './scrape.routes.js';

const router = Router();

router.use('/evaluate', evaluateRoutes);
router.use('/health', healthRoutes);
router.use('/scrape', scrapeRoutes);

export default router;
