import { isValidObjectId } from 'mongoose';
import { SavedScanModel, type SavedScanDocument } from '../models/savedScan.model.js';
import type { SaveScanRequest, SavedScanResponse } from '../schemas/savedScan.schema.js';

/** The most scans one list returns. */
export const SAVED_SCAN_LIST_LIMIT = 100;

/** Fields never read back from the database: the owner's ID and Mongoose's version key. */
const HIDDEN_FIELDS = '-userId -__v';

/** A stored scan as it is read back, without the hidden fields. */
type StoredScan = Omit<SavedScanDocument, 'userId'>;

/** A query for one scan that belongs to one student. */
interface OwnedScanFilter {
  /** The scan's ID. */
  _id: string;
  /** The owner's Clerk user ID. */
  userId: string;
}

/**
 * Turns a stored scan into the API shape.
 *
 * @param doc The stored scan.
 * @returns The scan as the API returns it, without the owner's user ID.
 */
function toResponse(doc: StoredScan): SavedScanResponse {
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
 * Builds the query for one of a student's scans. Every single-scan lookup goes through here, so
 * a scan can only ever be read or deleted by its owner.
 *
 * @param userId The student's Clerk user ID.
 * @param id The scan's ID.
 * @returns The query, or null when the ID is malformed, so there is nothing to look up.
 */
function ownedScan(userId: string, id: string): OwnedScanFilter | null {
  return isValidObjectId(id) ? { _id: id, userId } : null;
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
    .select(HIDDEN_FIELDS)
    .sort({ createdAt: -1 })
    .limit(SAVED_SCAN_LIST_LIMIT)
    .lean<StoredScan[]>();
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
  const filter = ownedScan(userId, id);
  if (!filter) {
    return null;
  }
  const doc = await SavedScanModel.findOne(filter).select(HIDDEN_FIELDS).lean<StoredScan>();
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
  const filter = ownedScan(userId, id);
  if (!filter) {
    return false;
  }
  const { deletedCount } = await SavedScanModel.deleteOne(filter);
  return deletedCount === 1;
}
