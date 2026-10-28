import { DatabaseSync } from "node:sqlite"; // built into Node >= 22.13: no native build step
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
export const db = new DatabaseSync(config.dbPath);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('author','admin')),
  name TEXT NOT NULL,
  phone TEXT, city TEXT, joined_date TEXT
);
CREATE TABLE IF NOT EXISTS books (
  book_id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL, isbn TEXT, genre TEXT, publication_date TEXT,
  status TEXT NOT NULL, mrp INTEGER, royalty_per_copy INTEGER,
  copies_sold INTEGER NOT NULL DEFAULT 0,
  royalty_earned INTEGER NOT NULL DEFAULT 0,
  royalty_paid INTEGER NOT NULL DEFAULT 0,
  royalty_pending INTEGER NOT NULL DEFAULT 0,
  last_payout_date TEXT, print_partner TEXT,
  available_on TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author_id);
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id TEXT NOT NULL REFERENCES users(id),
  book_id TEXT REFERENCES books(book_id),
  subject TEXT NOT NULL, description TEXT NOT NULL, attachment_name TEXT,
  status TEXT NOT NULL DEFAULT 'Open',
  category TEXT, category_source TEXT NOT NULL DEFAULT 'heuristic',  -- ai | heuristic | admin
  priority TEXT, priority_source TEXT NOT NULL DEFAULT 'heuristic',
  ai_status TEXT NOT NULL DEFAULT 'pending',                          -- pending | done | failed
  ai_reason TEXT,
  assigned_to TEXT REFERENCES users(id),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tickets_author ON tickets(author_id);
CREATE INDEX IF NOT EXISTS idx_tickets_queue ON tickets(status, priority, created_at);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id),
  sender_role TEXT NOT NULL,
  body TEXT NOT NULL,
  internal INTEGER NOT NULL DEFAULT 0,  -- 1 = admin-only note, never sent to authors
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON messages(ticket_id, id);
-- Cached AI drafts, keyed by a hash of everything that went into the prompt.
CREATE TABLE IF NOT EXISTS ai_drafts (
  ticket_id INTEGER PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
  input_hash TEXT NOT NULL, body TEXT NOT NULL, model TEXT NOT NULL, created_at TEXT NOT NULL
);
`);
try {
  db.exec("ALTER TABLE tickets ADD COLUMN attachment_path TEXT");
} catch {
  /* already migrated */
}
