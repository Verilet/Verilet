import { z } from 'zod';

/** Database used for rent data when RENT_DB_NAME is not set. */
export const DEFAULT_RENT_DB_NAME = 'averagePrice';

/** A MongoDB database name: no spaces or / \ . " $ * < > : | ?, at most 63 characters. */
export const RentDbNameSchema = z
  .string()
  .max(63)
  .regex(/^[^/\\. "$*<>:|?]+$/);

/**
 * Returns the database that holds rent data: RENT_DB_NAME without surrounding spaces,
 * or averagePrice when it is unset or empty. Throws if the name is not a valid database name.
 */
export function getRentDbName(env: NodeJS.ProcessEnv = process.env): string {
  const name = env.RENT_DB_NAME?.trim();
  if (!name) return DEFAULT_RENT_DB_NAME;

  const parsed = RentDbNameSchema.safeParse(name);
  if (!parsed.success) {
    throw new Error(`RENT_DB_NAME "${name}" is not a valid MongoDB database name`);
  }
  return parsed.data;
}
