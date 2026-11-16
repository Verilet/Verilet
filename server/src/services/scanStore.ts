import { isValidObjectId } from 'mongoose';
import { ScanModel, type ScanDocument } from '../models/scan.model.js';
import type { ScanInput, ScanResponse } from '../schemas/scan.schema.js';

/** A scan ready to save: the student's input plus its score. */
export type NewScan = ScanInput & Pick<ScanResponse, 'score' | 'checks'>;

/** The most scans returned in one list. */
export const SCAN_LIST_LIMIT = 100;

/** Turns a stored document into the API shape, leaving out the owner's user ID. */
function toResponse(doc: ScanDocument): ScanResponse {
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

/** Saves a scan for a student and returns it. */
export async function insertScan(userId: string, scan: NewScan): Promise<ScanResponse> {
  const doc = await ScanModel.create({ userId, ...scan });
  return toResponse(doc.toObject() as ScanDocument);
}

/** A student's scans, newest first. */
export async function findScans(userId: string): Promise<ScanResponse[]> {
  const docs = await ScanModel.find({ userId })
    .sort({ createdAt: -1 })
    .limit(SCAN_LIST_LIMIT)
    .lean<ScanDocument[]>();
  return docs.map(toResponse);
}

/** One of a student's scans, or null if it doesn't exist or belongs to someone else. */
export async function findScan(userId: string, id: string): Promise<ScanResponse | null> {
  if (!isValidObjectId(id)) {
    return null;
  }
  const doc = await ScanModel.findOne({ _id: id, userId }).lean<ScanDocument>();
  return doc ? toResponse(doc) : null;
}

/** Deletes one of a student's scans. Resolves false if there was nothing of theirs to delete. */
export async function removeScan(userId: string, id: string): Promise<boolean> {
  if (!isValidObjectId(id)) {
    return false;
  }
  const { deletedCount } = await ScanModel.deleteOne({ _id: id, userId });
  return deletedCount === 1;
}
