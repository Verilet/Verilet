import { Schema, model, type InferSchemaType, type Types } from 'mongoose';
import { BEDROOM_VALUES, CHECK_STATUSES, PAYMENT_VALUES } from '../schemas/scan.schema.js';

const checkSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    detail: { type: String, required: true },
    status: { type: String, enum: CHECK_STATUSES, required: true },
  },
  { _id: false },
);

/** A listing a student checked, with its score. Belongs to one Clerk user. */
const scanSchema = new Schema(
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

// A student's scans are always read newest first.
scanSchema.index({ userId: 1, createdAt: -1 });

export type ScanDocument = InferSchemaType<typeof scanSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
};

export const ScanModel = model('Scan', scanSchema);
