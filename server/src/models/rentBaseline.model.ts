import mongoose, { Schema } from 'mongoose';

/** One average-rent record in the averagePrice.santaCruz collection. */
export interface RentBaseline {
  county: string;
  zipCode?: string;
  roomType: string;
  /** Average monthly rent */
  price: number;
  /** Year the average applies to. */
  year: number;
  source: string;
}

const rentBaselineSchema = new Schema<RentBaseline>({
  county: { type: String },
  zipCode: { type: String },
  roomType: { type: String, required: true },
  price: { type: Number, required: true },
  year: { type: Number, required: true },
  source: { type: String, required: true },
});

// The rent data lives in the averagePricedatabase
const averagePriceDb = mongoose.connection.useDb('averagePrice', { useCache: true });

/**
 * Query Santa Cruz County rents.
 * Room types: "2br", "3br", "4br", "room in shared house", "Studio"
 * "1br/Duplex", "1br Apartment/Condo"
 */
export const SantaCruzRentModel = averagePriceDb.model<RentBaseline>(
  'SantaCruzRent',
  rentBaselineSchema,
  'santaCruz',
);

/**
 * Query San Jose-Sunnyvale-Santa Clara rents.
 * Room types "2br", "3br", "4br", "1br in a shared home", "Studio", "1br"
 */
export const SanJoseRentModel = averagePriceDb.model<RentBaseline>(
  'SanJoseRent',
  rentBaselineSchema,
  'sanJose-sunnyVale-santaClara',
);
