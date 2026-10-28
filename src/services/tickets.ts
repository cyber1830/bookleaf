import type { SQLInputValue } from "node:sqlite";
import { db } from "../db.js";
import type { Category, Priority, Status } from "../domain.js";
import { emitTicket } from "../events.js";
import { heuristicTriage } from "../ai/fallback.js";
import { runTriage } from "../ai/triage.js";
import { ApiError } from "../http.js";

const now = () => new Date().toISOString();

const BASE = `SELECT t.*, a.name AS author_name, a.email AS author_email, b.title AS book_title, s.name AS assigned_name
  FROM tickets t JOIN users a ON a.id = t.author_id
  LEFT JOIN books b ON b.book_id = t.book_id LEFT JOIN users s ON s.id = t.assigned_to`;

/** Authors get a trimmed DTO: no AI metadata, no assignment details. */
export function toDto(r: any, admin: boolean) {
  const dto = {
    id: r.id,
    subject: r.subject,
    description: r.description,
    attachmentName: r.attachment_name,
    attachmentUrl: r.attachment_path ? `/api/tickets/${r.id}/attachment` : null,
    status: r.status as Status,
    bookId: r.book_id,
    bookTitle: r.book_title ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  if (!admin) return dto;
  return {
    ...dto,
    authorId: r.author_id,
    authorName: r.author_name,
    authorEmail: r.author_email,
    category: r.category,
    categorySource: r.category_source,
    priority: r.priority,
    prioritySource: r.priority_source,
    aiStatus: r.ai_status,
    aiReason: r.ai_reason,
    assignedTo: r.assigned_to,
    assignedName: r.assigned_name ?? null,
  };
}

export function messagesFor(ticketId: number, includeInternal: boolean) {
  const rows = db
    .prepare(
      `SELECT m.*, u.name AS sender_name FROM messages m JOIN users u ON u.id = m.sender_id
       WHERE m.ticket_id = ? ${includeInternal ? "" : "AND m.internal = 0"} ORDER BY m.id`,
    )
    .all(ticketId) as any[];
  return rows.map((m) => ({
    id: m.id,
    senderRole: m.sender_role,
    senderName: m.sender_name,
    body: m.body,
    internal: !!m.internal,
    createdAt: m.created_at,
  }));
}

export function getRow(id: number) {
  const row = db.prepare(`${BASE} WHERE t.id = ?`).get(id);
  if (!row) throw new ApiError(404, "NOT_FOUND", "Ticket not found");
  return row as any;
}

/** Authors may only touch their own tickets. 404 (not 403) so ticket ids can't be probed. */
export function getOwnedRow(id: number, authorId: string) {
  const row = getRow(id);
  if (row.author_id !== authorId)
    throw new ApiError(404, "NOT_FOUND", "Ticket not found");
  return row;
}

export function createTicket(
  authorId: string,
  input: {
    bookId?: string | null;
    subject: string;
    description: string;
    attachmentName?: string;
    attachmentPath?: string;
  },
) {
  if (input.bookId) {
    const owns = db
      .prepare("SELECT 1 FROM books WHERE book_id = ? AND author_id = ?")
      .get(input.bookId, authorId);
    if (!owns)
      throw new ApiError(
        400,
        "INVALID_BOOK",
        "That book is not on your account",
      );
  }
  const h = heuristicTriage(input.subject, input.description); // provisional, instant, free
  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO tickets (author_id, book_id, subject, description, attachment_name, attachment_path, category, priority, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      authorId,
      input.bookId ?? null,
      input.subject,
      input.description,
      input.attachmentName ?? null,
      input.attachmentPath ?? null,
      h.category,
      h.priority,
      ts,
      ts,
    );
  const id = Number(info.lastInsertRowid);
  emitTicket(id, authorId);
  void runTriage(id); // async: ticket creation never waits on (or fails because of) the AI
  return id;
}

export function listForAuthor(authorId: string) {
  const rows = db
    .prepare(`${BASE} WHERE t.author_id = ? ORDER BY t.updated_at DESC`)
    .all(authorId) as any[];
  return rows.map((r) => ({
    ...toDto(r, false),
    messages: messagesFor(r.id, false),
  }));
}

export interface AdminFilters {
  status?: Status;
  category?: Category;
  priority?: Priority;
  assigned?: "me" | "unassigned";
  from?: string;
  to?: string;
}

/** Queue order: unresolved first, then priority, then oldest first - so urgent + stale tickets float up. */
export function listForAdmin(f: AdminFilters, adminId: string) {
  const where: string[] = [];
  const args: SQLInputValue[] = [];
  if (f.status) {
    where.push("t.status = ?");
    args.push(f.status);
  }
  if (f.category) {
    where.push("t.category = ?");
    args.push(f.category);
  }
  if (f.priority) {
    where.push("t.priority = ?");
    args.push(f.priority);
  }
  if (f.assigned === "me") {
    where.push("t.assigned_to = ?");
    args.push(adminId);
  }
  if (f.assigned === "unassigned") where.push("t.assigned_to IS NULL");
  if (f.from) {
    where.push("t.created_at >= ?");
    args.push(f.from);
  }
  if (f.to) {
    where.push("t.created_at < date(?, '+1 day')");
    args.push(f.to);
  }
  const sql = `${BASE} ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY CASE WHEN t.status IN ('Resolved','Closed') THEN 1 ELSE 0 END,
             CASE t.priority WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
             t.created_at ASC`;
  return (db.prepare(sql).all(...args) as any[]).map((r) => toDto(r, true));
}

export function addMessage(
  ticketId: number,
  sender: { id: string; role: "author" | "admin" },
  body: string,
  internal = false,
) {
  db.prepare(
    "INSERT INTO messages (ticket_id, sender_id, sender_role, body, internal, created_at) VALUES (?,?,?,?,?,?)",
  ).run(ticketId, sender.id, sender.role, body, internal ? 1 : 0, now());
}

export function touch(ticketId: number, authorId: string) {
  db.prepare("UPDATE tickets SET updated_at = ? WHERE id = ?").run(
    now(),
    ticketId,
  );
  emitTicket(ticketId, authorId);
}

export function authorFollowUp(
  ticketId: number,
  author: { id: string },
  body: string,
) {
  const t = getOwnedRow(ticketId, author.id);
  if (t.status === "Closed")
    throw new ApiError(
      409,
      "TICKET_CLOSED",
      "This ticket is closed. Please open a new query.",
    );
  addMessage(ticketId, { id: author.id, role: "author" }, body);
  if (t.status === "Resolved")
    db.prepare("UPDATE tickets SET status = 'Open' WHERE id = ?").run(ticketId); // reopen
  touch(ticketId, author.id);
}

export function adminReply(
  ticketId: number,
  admin: { id: string },
  body: string,
  status?: Status,
) {
  const t = getRow(ticketId);
  addMessage(ticketId, { id: admin.id, role: "admin" }, body);
  const next = status ?? (t.status === "Open" ? "In Progress" : t.status);
  db.prepare(
    "UPDATE tickets SET status = ?, assigned_to = COALESCE(assigned_to, ?) WHERE id = ?",
  ).run(next, admin.id, ticketId);
  touch(ticketId, t.author_id);
}

export function adminPatch(
  ticketId: number,
  admin: { id: string },
  p: {
    status?: Status;
    category?: Category;
    priority?: Priority;
    assignedTo?: "me" | null;
  },
) {
  const t = getRow(ticketId);
  const sets: string[] = [];
  const args: SQLInputValue[] = [];
  if (p.status) {
    sets.push("status = ?");
    args.push(p.status);
  }
  if (p.category) {
    sets.push("category = ?, category_source = 'admin'");
    args.push(p.category);
  }
  if (p.priority) {
    sets.push("priority = ?, priority_source = 'admin'");
    args.push(p.priority);
  }
  if (p.assignedTo !== undefined) {
    sets.push("assigned_to = ?");
    args.push(p.assignedTo === "me" ? admin.id : null);
  }
  db.prepare(
    `UPDATE tickets SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`,
  ).run(...args, now(), ticketId);
  emitTicket(ticketId, t.author_id);
}
