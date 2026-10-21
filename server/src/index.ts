import 'dotenv/config';
import app from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';

/**
 * Server Entry Point
 *
 * Loads environment variables, connects to MongoDB,
 * then starts the HTTP server on the configured PORT.
 * Handles shutdown on SIGTERM and SIGINT.
 */
const PORT = process.env.PORT || 5000;

async function main(): Promise<void> {
  await connectDatabase();

  const server = app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`${signal} received, shutting down gracefully`);
    server.close(async () => {
      await disconnectDatabase();
      console.log('Server shut down');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err: Error) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
