import { Router } from 'express';
import path from 'node:path';
import { z } from 'zod';
import { getDraft } from '../ai/draft.js';
import { runTriage } from '../ai/triage.js';
import { authenticate, requireRole } from '../auth.js';
import { db } from '../db.js';
import { parse } from '../http.js';
import { adminListQuery, messageSchema, patchTicketSchema, replySchema } from '../schemas.js';
import * as tickets from '../services/tickets.js';
import { config } from '../config.js';

export const adminRoutes = Router();
adminRoutes.use(authenticate, requireRole('admin')); // every /api/admin route is admin-only
const id = (v: unknown) => parse(z.coerce.number().int().positive(), v);

adminRoutes.get('/tickets', (req, res) => {
  res.json({ tickets: tickets.listForAdmin(parse(adminListQuery, req.query), req.user!.id) });
});

adminRoutes.get('/tickets/:id', (req, res) => {
  const row = tickets.getRow(id(req.params.id));
  const book = row.book_id ? db.prepare('SELECT * FROM books WHERE book_id = ?').get(row.book_id) : null;
  res.json({ ticket: tickets.toDto(row, true), messages: tickets.messagesFor(row.id, true), book });
});

adminRoutes.get('/tickets/:id/attachment', authenticate, requireRole('admin'), (req, res) => {
  const row = tickets.getRow(id(req.params.id));
  if (!row.attachment_path) return res.status(404).json({ error: { code: 'NO_ATTACHMENT', message: 'No attachment found' } });
  res.download(path.resolve(config.uploadDir, row.attachment_path), row.attachment_name);
});

adminRoutes.patch('/tickets/:id', (req, res) => {
  const tid = id(req.params.id);
  tickets.adminPatch(tid, req.user!, parse(patchTicketSchema, req.body));
  res.json({ ticket: tickets.toDto(tickets.getRow(tid), true) });
});

adminRoutes.post('/tickets/:id/reply', (req, res) => {
  const { body, status } = parse(replySchema, req.body);
  tickets.adminReply(id(req.params.id), req.user!, body, status);
  res.status(201).json({ ok: true });
});

adminRoutes.post('/tickets/:id/notes', (req, res) => {
  const tid = id(req.params.id);
  const t = tickets.getRow(tid);
  tickets.addMessage(tid, req.user!, parse(messageSchema, req.body).body, true);
  tickets.touch(tid, t.author_id);
  res.status(201).json({ ok: true });
});

adminRoutes.get('/tickets/:id/draft', async (req, res) => {
  tickets.getRow(id(req.params.id)); // 404 early
  res.json(await getDraft(id(req.params.id), req.query.refresh === '1'));
});

adminRoutes.post('/tickets/:id/ai/retry', async (req, res) => {
  const tid = id(req.params.id);
  tickets.getRow(tid);
  await runTriage(tid);
  res.json({ ticket: tickets.toDto(tickets.getRow(tid), true) });
});
