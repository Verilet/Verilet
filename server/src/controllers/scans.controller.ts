import type { Request, Response } from 'express';
import { signedInUserId } from '../middleware/auth.middleware.js';
import type { SaveScanRequest } from '../schemas/savedScan.schema.js';
import { deleteScan, getScan, listScans, saveScan } from '../services/scanPersistence.service.js';

/** The answer for a scan that doesn't exist or belongs to someone else. */
const NOT_FOUND = { success: false, error: "We couldn't find that scan." };

/**
 * Runs a handler's work and sends the standard answer: the data with `successStatus`, a 404 when
 * the work finds nothing (null), or a 500 with `failMessage` when it throws.
 *
 * @param res The response.
 * @param successStatus The status for a successful answer, 200 or 201.
 * @param failMessage What couldn't be done, shown to the student on a 500.
 * @param work Does the handler's job; resolves null when there is no such scan.
 * @returns The response.
 */
async function respond<T>(
  res: Response,
  successStatus: number,
  failMessage: string,
  work: () => Promise<T | null>,
): Promise<Response> {
  try {
    const data = await work();
    if (data === null) {
      return res.status(404).json(NOT_FOUND);
    }
    return res.status(successStatus).json({ success: true, data });
  } catch (err) {
    console.error(failMessage, err instanceof Error ? err.message : err);
    return res.status(500).json({ success: false, error: failMessage });
  }
}

/**
 * POST /api/scans: saves a scan for the signed-in student.
 *
 * @param req The request, with a body already checked by `saveScanRequestSchema`.
 * @param res The response.
 * @returns 201 with the saved scan, or 500.
 */
export function createSavedScan(req: Request, res: Response): Promise<Response> {
  return respond(res, 201, "We couldn't save that scan.", () =>
    saveScan(signedInUserId(res), req.body as SaveScanRequest),
  );
}

/**
 * GET /api/scans: the signed-in student's scans, newest first.
 *
 * @param _req The request.
 * @param res The response.
 * @returns 200 with the scans, or 500.
 */
export function listSavedScans(_req: Request, res: Response): Promise<Response> {
  return respond(res, 200, "We couldn't load your scans.", () => listScans(signedInUserId(res)));
}

/**
 * GET /api/scans/:id: one of the signed-in student's scans.
 *
 * @param req The request, with the scan ID in the path.
 * @param res The response.
 * @returns 200 with the scan, 404, or 500.
 */
export function getSavedScan(req: Request<{ id: string }>, res: Response): Promise<Response> {
  return respond(res, 200, "We couldn't load that scan.", () =>
    getScan(signedInUserId(res), req.params.id),
  );
}

/**
 * DELETE /api/scans/:id: deletes one of the signed-in student's scans.
 *
 * @param req The request, with the scan ID in the path.
 * @param res The response.
 * @returns 200 with the deleted scan's ID, 404, or 500.
 */
export function deleteSavedScan(req: Request<{ id: string }>, res: Response): Promise<Response> {
  return respond(res, 200, "We couldn't delete that scan.", async () =>
    (await deleteScan(signedInUserId(res), req.params.id)) ? { id: req.params.id } : null,
  );
}
