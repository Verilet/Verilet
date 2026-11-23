import { type Request, type Response } from 'express';
import { orchestrateEvaluation } from '../services/evaluateOrchestrator.service.js';

/**
 * Handles POST /api/evaluate requests.
 * Executes full concurrent listing evaluation and returns HTTP 200 with standardized envelope.
 *
 * @param req Express request object containing validated EvaluateRequest payload
 * @param res Express response object
 */
export async function evaluateListing(req: Request, res: Response): Promise<void> {
  try {
    const result = await orchestrateEvaluation(req.body);
    res.status(200).json(result);
  } catch (error: unknown) {
    console.error('Unhandled evaluation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal evaluation error',
      details: error instanceof Error ? error.message : 'Unknown internal error',
    });
  }
}
