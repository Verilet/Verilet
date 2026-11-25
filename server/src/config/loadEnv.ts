import dotenv from 'dotenv';

/**
 * Loads `server/.env.local` and `server/.env` into `process.env`. Imported first in `index.ts`, so
 * the settings are in place before `app.ts` and every route and model module runs. `.env.local`,
 * where `clerk env pull` writes the Clerk keys, wins over `.env`.
 */
dotenv.config({ path: ['.env.local', '.env'], quiet: true });
