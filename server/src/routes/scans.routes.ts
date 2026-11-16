import { Router } from 'express';
import { createScan, deleteScan, getScan, listScans } from '../controllers/scans.controller.js';
import { clerkSession, requireClerkConfig, requireUser } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validateBody.middleware.js';
import { scanInputSchema } from '../schemas/scan.schema.js';

/** /api/scans: a signed-in student's saved scans. See docs/specs/scans-api.md. */
const router = Router();

router.use(requireClerkConfig, clerkSession, requireUser);
router.post('/', validateBody(scanInputSchema), createScan);
router.get('/', listScans);
router.get('/:id', getScan);
router.delete('/:id', deleteScan);

export default router;
