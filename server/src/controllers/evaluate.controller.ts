import { type Request, type Response } from 'express';
import type { EvaluateResponse } from '../schemas/evaluate.schema.js';
import { orchestrateEvaluation } from '../services/evaluateOrchestrator.service.js';
import { calculateListingScore } from '../services/scoringEngine.service.js';

/**
 * Handles POST /api/evaluate requests.
 * Executes full concurrent listing evaluation, scores the aggregated raw checks,
 * and returns HTTP 200 with a standardized JSON envelope.
 *
 * @param req Express request object containing validated EvaluateRequest payload
 * @param res Express response object
 */
export async function evaluateListing(req: Request, res: Response): Promise<void> {
  try {
    const orchestration = await orchestrateEvaluation(req.body);
    const { rawChecks } = orchestration.data;
    const scoreResult = calculateListingScore(rawChecks);
    const response: EvaluateResponse = {
      success: true,
      data: {
        ...scoreResult,
        rawChecks,
      },
    };
    res.status(200).json(response);
  } catch (error: unknown) {
    console.error('Unhandled evaluation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal evaluation error',
      details: [error instanceof Error ? error.message : 'Unknown internal error'],
    });
  }
}
