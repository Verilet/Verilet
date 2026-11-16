import { Router } from 'express';
import { checkAsGuest } from '../controllers/check.controller.js';
import { guestCheckLimiter } from '../middleware/rateLimit.middleware.js';
import { validateBody } from '../middleware/validateBody.middleware.js';
import { scanInputSchema } from '../schemas/scan.schema.js';

/** /api/check: scores a listing for anyone, without an account and without saving it. */
const router = Router();

router.post('/', guestCheckLimiter, validateBody(scanInputSchema), checkAsGuest);

export default router;
