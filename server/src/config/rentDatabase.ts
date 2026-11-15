import { z } from 'zod';

/** Database used for rent data when RENT_DB_NAME is not set. */
export const DEFAULT_RENT_DB_NAME = 'averagePrice';

/** A MongoDB database name: no spaces or / \ . " $ * < > : | ?, at most 63 characters. */
export const RentDbNameSchema = z
  .string()
  .max(63)
  .regex(/^[^/\\. "$*<>:|?]+$/);

/**
 * Gets the name of the database that holds rent data.
 *
 * @param env Environment variables to read RENT_DB_NAME from.
 * @return The trimmed RENT_DB_NAME, or averagePrice when it is unset or empty.
 * @throws Error if RENT_DB_NAME is not a valid MongoDB database name.
 */
export function getRentDbName(env: NodeJS.ProcessEnv = process.env): string {
  const name = env.RENT_DB_NAME?.trim();
  if (!name) {
    return DEFAULT_RENT_DB_NAME;
  }

  const parsed = RentDbNameSchema.safeParse(name);
  if (!parsed.success) {
    throw new Error(`RENT_DB_NAME "${name}" is not a valid MongoDB database name`);
  }
  return parsed.data;
}
