import express from 'express';
import { fileURLToPath } from 'node:url';
import { errorHandler, notFound } from './http.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { authorRoutes } from './routes/author.js';
import { eventsRoute } from './routes/events.js';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/events', eventsRoute);
  app.use('/api/admin', adminRoutes);
  app.use('/api', authorRoutes);
  app.use('/api', notFound);
  // fileURLToPath (not URL.pathname) so the path is valid on Windows and with spaces in folder names
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
  app.use(errorHandler);
  return app;
}
