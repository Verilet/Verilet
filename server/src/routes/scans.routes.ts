import { Router } from 'express';
import {
  createSavedScan,
  deleteSavedScan,
  getSavedScan,
  listSavedScans,
} from '../controllers/scans.controller.js';
import { clerkSession, requireClerkConfig, requireUser } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validateBody.middleware.js';
import { saveScanRequestSchema } from '../schemas/savedScan.schema.js';

/** /api/scans: a signed-in student's saved scans. See docs/specs/scans-api.md. */
const router = Router();

// Every route needs the Clerk keys and a signed-in user, checked in this order.
router.use(requireClerkConfig, clerkSession, requireUser);
router.post('/', validateBody(saveScanRequestSchema), createSavedScan);
router.get('/', listSavedScans);
router.get('/:id', getSavedScan);
router.delete('/:id', deleteSavedScan);

export default router;
