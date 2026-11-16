import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';

/**
 * Express Application Configuration
 *
 * Configures middleware and mounts API routes.
 * Exports the `app` instance without calling `app.listen()` so that
 * automated tests (such as Supertest) can test HTTP endpoints in-memory
 * without binding to a live network port or causing address-in-use conflicts.
 */
const app = express();

// Render puts one proxy in front of the server. Trusting it gives each visitor's own address to
// the guest check's rate limit, instead of the proxy's.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// API route registry
app.use('/api', routes);

export default app;
export { app };
