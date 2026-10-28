import { Router } from 'express';
import { verifyToken } from '../auth.js';
import { addClient } from '../events.js';

export const eventsRoute = Router();

/** SSE stream. EventSource can't send headers, so the JWT travels as ?token=. */
eventsRoute.get('/', (req, res) => {
  const user = verifyToken(String(req.query.token ?? ''));
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  const remove = addClient({ res, userId: user.id, role: user.role });
  req.on('close', remove);
});
