import type { Request, Response } from 'express';
import type { SaveScanRequest } from '../schemas/savedScan.schema.js';
import { deleteScan, getScan, listScans, saveScan } from '../services/scanPersistence.service.js';

/** The answer for a scan that doesn't exist or belongs to someone else. */
const NOT_FOUND = { success: false, error: "We couldn't find that scan." };

/**
 * The signed-in student's Clerk user ID, which `requireUser` put in `res.locals`.
 *
 * @param res The response.
 * @returns The user ID.
 */
function userIdOf(res: Response): string {
  return String(res.locals.userId);
}

/**
 * Logs a failure and answers 500 with the error envelope.
 *
 * @param res The response.
 * @param message What couldn't be done, shown to the student.
 * @param err What went wrong.
 * @returns The 500 response.
 */
function serverError(res: Response, message: string, err: unknown) {
  console.error(message, err instanceof Error ? err.message : err);
  return res.status(500).json({ success: false, error: message });
}

/**
 * POST /api/scans: saves a scan for the signed-in student.
 *
 * @param req The request, with a body already checked by `saveScanRequestSchema`.
 * @param res The response.
 * @returns 201 with the saved scan, or 500.
 */
export async function createSavedScan(req: Request, res: Response) {
  try {
    const scan = await saveScan(userIdOf(res), req.body as SaveScanRequest);
    return res.status(201).json({ success: true, data: scan });
  } catch (err) {
    return serverError(res, "We couldn't save that scan.", err);
  }
}

/**
 * GET /api/scans: the signed-in student's scans, newest first.
 *
 * @param _req The request.
 * @param res The response.
 * @returns 200 with the scans, or 500.
 */
export async function listSavedScans(_req: Request, res: Response) {
  try {
    return res.status(200).json({ success: true, data: await listScans(userIdOf(res)) });
  } catch (err) {
    return serverError(res, "We couldn't load your scans.", err);
  }
}

/**
 * GET /api/scans/:id: one of the signed-in student's scans.
 *
 * @param req The request, with the scan ID in the path.
 * @param res The response.
 * @returns 200 with the scan, 404, or 500.
 */
export async function getSavedScan(req: Request<{ id: string }>, res: Response) {
  try {
    const scan = await getScan(userIdOf(res), req.params.id);
    if (!scan) {
      return res.status(404).json(NOT_FOUND);
    }
    return res.status(200).json({ success: true, data: scan });
  } catch (err) {
    return serverError(res, "We couldn't load that scan.", err);
  }
}

/**
 * DELETE /api/scans/:id: deletes one of the signed-in student's scans.
 *
 * @param req The request, with the scan ID in the path.
 * @param res The response.
 * @returns 200 with the deleted scan's ID, 404, or 500.
 */
export async function deleteSavedScan(req: Request<{ id: string }>, res: Response) {
  try {
    const deleted = await deleteScan(userIdOf(res), req.params.id);
    if (!deleted) {
      return res.status(404).json(NOT_FOUND);
    }
    return res.status(200).json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    return serverError(res, "We couldn't delete that scan.", err);
  }
}
