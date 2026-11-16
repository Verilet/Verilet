import type { Request, Response } from 'express';
import type { ScanInput } from '../schemas/scan.schema.js';
import { scoreListing } from '../services/scoring.service.js';

/** POST /api/check: scores a listing for a guest without saving it. */
export function checkAsGuest(req: Request, res: Response) {
  try {
    return res.status(200).json({ success: true, data: scoreListing(req.body as ScanInput) });
  } catch (err) {
    console.error("We couldn't check that listing.", err instanceof Error ? err.message : err);
    return res.status(500).json({ success: false, error: "We couldn't check that listing." });
  }
}
