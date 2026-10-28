import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { authenticate, requireRole } from "../auth.js";
import { db } from "../db.js";
import { parse } from "../http.js";
import { createTicketSchema, messageSchema } from "../schemas.js";
import * as tickets from "../services/tickets.js";
import { config } from "../config.js";

export const authorRoutes = Router();
const guard = [authenticate, requireRole("author")];
const id = (v: unknown) => parse(z.coerce.number().int().positive(), v);
fs.mkdirSync(path.resolve(config.uploadDir), { recursive: true });
const upload = multer({
  dest: path.resolve(config.uploadDir),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    cb(
      null,
      /^(image\/(png|jpeg|webp)|application\/pdf|text\/plain)$/.test(
        file.mimetype,
      ),
    ),
});

authorRoutes.get("/books", ...guard, (req, res) => {
  const rows = db
    .prepare(
      "SELECT * FROM books WHERE author_id = ? ORDER BY publication_date IS NULL, publication_date",
    )
    .all(req.user!.id) as any[];
  res.json({
    books: rows.map((b) => ({
      id: b.book_id,
      title: b.title,
      isbn: b.isbn,
      genre: b.genre,
      publicationDate: b.publication_date,
      status: b.status,
      mrp: b.mrp,
      royaltyPerCopy: b.royalty_per_copy,
      copiesSold: b.copies_sold,
      royaltyEarned: b.royalty_earned,
      royaltyPaid: b.royalty_paid,
      royaltyPending: b.royalty_pending,
      lastPayoutDate: b.last_payout_date,
      availableOn: JSON.parse(b.available_on),
      inProduction: b.publication_date === null, // drives the "no sales yet" empty state in the UI
    })),
  });
});

authorRoutes.get("/tickets", ...guard, (req, res) =>
  res.json({ tickets: tickets.listForAuthor(req.user!.id) }),
);

authorRoutes.post("/tickets", ...guard, upload.single("file"), (req, res) => {
  const input = parse(createTicketSchema, {
    ...req.body,
    bookId: req.body.bookId || null,
    attachmentName: req.file?.originalname,
  });
  const newId = tickets.createTicket(req.user!.id, {
    ...input,
    attachmentPath: req.file?.filename,
  });
  const row = tickets.getOwnedRow(newId, req.user!.id);
  res
    .status(201)
    .json({ ticket: { ...tickets.toDto(row, false), messages: [] } });
});

authorRoutes.get("/tickets/:id/attachment", ...guard, (req, res) => {
  const row = tickets.getOwnedRow(id(req.params.id), req.user!.id);
  if (!row.attachment_path)
    return res.status(404).json({
      error: { code: "NO_ATTACHMENT", message: "No attachment found" },
    });
  res.download(
    path.resolve(config.uploadDir, row.attachment_path),
    row.attachment_name,
  );
});

authorRoutes.get("/tickets/:id", ...guard, (req, res) => {
  const row = tickets.getOwnedRow(id(req.params.id), req.user!.id);
  res.json({
    ticket: {
      ...tickets.toDto(row, false),
      messages: tickets.messagesFor(row.id, false),
    },
  });
});

authorRoutes.post("/tickets/:id/messages", ...guard, (req, res) => {
  const { body } = parse(messageSchema, req.body);
  tickets.authorFollowUp(id(req.params.id), req.user!, body);
  res.status(201).json({ ok: true });
});
