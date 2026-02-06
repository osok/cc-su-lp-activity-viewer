/**
 * Express server for the Activity Log Viewer.
 * SI-002: Serve React SPA static assets.
 * SE-002: No persistent server state.
 * CI-001: Configurable port, default 3000.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || 'localhost';
const STATIC_DIR = path.join(__dirname, '../client');

// Security headers
app.use((_req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// Static assets
app.use(express.static(STATIC_DIR));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Activity Log Viewer server running at http://${HOST}:${PORT}`);
});

export default app;
