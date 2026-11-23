import { isValidObjectId } from 'mongoose';
import { SavedScanModel, type SavedScanDocument } from '../models/savedScan.model.js';
import type { SaveScanRequest, SavedScanResponse } from '../schemas/savedScan.schema.js';

/** The most scans one list returns. */
export const SAVED_SCAN_LIST_LIMIT = 100;

/**
 * Turns a stored scan into the API shape, leaving out the owner's user ID.
 *
 * @param doc The stored scan.
 * @returns The scan as the API returns it.
 */
function toResponse(doc: SavedScanDocument): SavedScanResponse {
  return {
    id: String(doc._id),
    createdAt: doc.createdAt.toISOString(),
    listingUrl: doc.listingUrl,
    rent: doc.rent,
    bedrooms: doc.bedrooms,
    location: doc.location,
    landlord: doc.landlord,
    payment: doc.payment,
    securityDeposit: doc.securityDeposit ?? null,
    applicationFee: doc.applicationFee ?? null,
    contactPhone: doc.contactPhone,
    description: doc.description,
    photoCount: doc.photoCount,
    score: doc.score,
    checks: doc.checks.map(({ id, title, detail, status }) => ({ id, title, detail, status })),
  };
}

/**
 * Saves a scan for a student.
 *
 * @param userId The Clerk user ID of the student who owns it.
 * @param scan The validated scan.
 * @returns The saved scan, with its ID and save time.
 */
export async function saveScan(userId: string, scan: SaveScanRequest): Promise<SavedScanResponse> {
  const doc = await SavedScanModel.create({ userId, ...scan });
  return toResponse(doc.toObject<SavedScanDocument>());
}

/**
 * Lists a student's scans, newest first.
 *
 * @param userId The student's Clerk user ID.
 * @returns Up to `SAVED_SCAN_LIST_LIMIT` of their scans.
 */
export async function listScans(userId: string): Promise<SavedScanResponse[]> {
  const docs = await SavedScanModel.find({ userId })
    .sort({ createdAt: -1 })
    .limit(SAVED_SCAN_LIST_LIMIT)
    .lean<SavedScanDocument[]>();
  return docs.map(toResponse);
}

/**
 * Finds one of a student's scans.
 *
 * @param userId The student's Clerk user ID.
 * @param id The scan's ID.
 * @returns The scan, or null if the ID is malformed, unknown or another student's.
 */
export async function getScan(userId: string, id: string): Promise<SavedScanResponse | null> {
  if (!isValidObjectId(id)) {
    return null;
  }
  const doc = await SavedScanModel.findOne({ _id: id, userId }).lean<SavedScanDocument>();
  return doc ? toResponse(doc) : null;
}

/**
 * Deletes one of a student's scans.
 *
 * @param userId The student's Clerk user ID.
 * @param id The scan's ID.
 * @returns True if it was deleted; false if the ID is malformed, unknown or another student's.
 */
export async function deleteScan(userId: string, id: string): Promise<boolean> {
  if (!isValidObjectId(id)) {
    return false;
  }
  const { deletedCount } = await SavedScanModel.deleteOne({ _id: id, userId });
  return deletedCount === 1;
}
