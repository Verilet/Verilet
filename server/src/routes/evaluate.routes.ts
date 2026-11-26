import { Router } from 'express';
import { evaluateListing } from '../controllers/evaluate.controller.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { EvaluateRequestSchema } from '../schemas/evaluate.schema.js';

const router = Router();

/**
 * POST /api/evaluate
 * Validates incoming rental listing payload and coordinates concurrent evaluation workers.
 */
router.post('/', validateBody(EvaluateRequestSchema), evaluateListing);

export default router;
