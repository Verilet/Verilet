import type { Request, Response } from 'express';
import type { ScanInput } from '../schemas/scan.schema.js';
import { scoreListing } from '../services/scoring.service.js';
import { findScan, findScans, insertScan, removeScan } from '../services/scanStore.js';

const NOT_FOUND = { success: false, error: "We couldn't find that scan." };

function userIdOf(res: Response): string {
  return res.locals.userId as string;
}

function serverError(res: Response, message: string, err: unknown) {
  console.error(message, err instanceof Error ? err.message : err);
  return res.status(500).json({ success: false, error: message });
}

/** POST /api/scans: scores the listing, saves it for the signed-in student, and returns it. */
export async function createScan(req: Request, res: Response) {
  const input = req.body as ScanInput;
  try {
    const scan = await insertScan(userIdOf(res), { ...input, ...scoreListing(input) });
    return res.status(201).json({ success: true, data: scan });
  } catch (err) {
    return serverError(res, "We couldn't save that scan.", err);
  }
}

/** GET /api/scans: the signed-in student's scans, newest first. */
export async function listScans(_req: Request, res: Response) {
  try {
    return res.status(200).json({ success: true, data: await findScans(userIdOf(res)) });
  } catch (err) {
    return serverError(res, "We couldn't load your scans.", err);
  }
}

/** GET /api/scans/:id: one of the signed-in student's scans. */
export async function getScan(req: Request<{ id: string }>, res: Response) {
  try {
    const scan = await findScan(userIdOf(res), req.params.id);
    return scan
      ? res.status(200).json({ success: true, data: scan })
      : res.status(404).json(NOT_FOUND);
  } catch (err) {
    return serverError(res, "We couldn't load that scan.", err);
  }
}

/** DELETE /api/scans/:id: deletes one of the signed-in student's scans. */
export async function deleteScan(req: Request<{ id: string }>, res: Response) {
  try {
    const deleted = await removeScan(userIdOf(res), req.params.id);
    return deleted
      ? res.status(200).json({ success: true, data: { id: req.params.id } })
      : res.status(404).json(NOT_FOUND);
  } catch (err) {
    return serverError(res, "We couldn't delete that scan.", err);
  }
}
