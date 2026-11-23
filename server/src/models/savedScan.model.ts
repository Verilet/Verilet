import { Schema, model, type InferSchemaType, type Types } from 'mongoose';
import { BEDROOM_VALUES, CHECK_STATUSES, PAYMENT_VALUES } from '../schemas/savedScan.schema.js';

/** One line of a saved scan's result. Stored inside the scan, without its own ID. */
const checkSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    detail: { type: String, default: '' },
    status: { type: String, enum: CHECK_STATUSES, required: true },
  },
  { _id: false },
);

/** A listing a student checked, with its result. Belongs to one Clerk user. */
const savedScanSchema = new Schema(
  {
    userId: { type: String, required: true },
    listingUrl: { type: String, required: true },
    rent: { type: Number, required: true, min: 0 },
    bedrooms: { type: String, enum: BEDROOM_VALUES, required: true },
    location: { type: String, required: true },
    landlord: { type: String, default: '' },
    payment: { type: String, enum: PAYMENT_VALUES, required: true },
    securityDeposit: { type: Number, default: null, min: 0 },
    applicationFee: { type: Number, default: null, min: 0 },
    contactPhone: { type: String, default: '' },
    description: { type: String, default: '' },
    photoCount: { type: Number, default: 0, min: 0 },
    score: { type: Number, required: true, min: 0, max: 100 },
    checks: { type: [checkSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// A student's scans are always read newest first, so this index serves every list.
savedScanSchema.index({ userId: 1, createdAt: -1 });

/** A saved scan as stored, with the fields Mongoose adds. */
export type SavedScanDocument = InferSchemaType<typeof savedScanSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
};

/** The `SavedScan` model, stored in the `savedscans` collection. */
export const SavedScanModel = model('SavedScan', savedScanSchema);
