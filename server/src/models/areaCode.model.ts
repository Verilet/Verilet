import mongoose, { Schema } from 'mongoose';

/** Area codes associated with a US state. */
export interface AreaCode {
  state: string;
  codes: string[];
}

const areaCodeSchema = new Schema<AreaCode>({
  state: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    match: /^[A-Z]{2}$/,
    unique: true,
  },
  codes: {
    type: [
      {
        type: String,
        match: /^\d{3}$/,
      },
    ],
    required: true,
    default: undefined,
  },
});

/** Model for state area-code mappings in the stateAreaCodes collection. */
export const AreaCodeModel = mongoose.connection.model<AreaCode>(
  'AreaCode',
  areaCodeSchema,
  'stateAreaCodes',
);
