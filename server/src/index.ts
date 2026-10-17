import app from './app.js';

/**
 * Server Entry Point
 *
 * Starts the HTTP server on the configured PORT.
 * For local development and production runtime.
 */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
