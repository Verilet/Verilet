import express, { Request, Response } from 'express';
import cors from 'cors';

/**
 * Express Application Configuration
 *
 * This file configures middleware and routes for the Express application.
 * It exports the `app` instance without calling `app.listen()` so that
 * automated tests (such as Supertest) can test HTTP endpoints in-memory
 * without binding to a live network port or causing address-in-use conflicts.
 */
const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
export { app };
