import bcrypt from "bcryptjs";
import fs from "node:fs";
import { db } from "./db.js";
import { createTicket, addMessage } from "./services/tickets.js";

export const DEMO_AUTHOR_PASSWORD = "author123";
export const ADMIN = {
  id: "ADM001",
  email: "admin@bookleaf.com",
  password: "admin123",
  name: "BookLeaf Support",
};

/** Seeds the provided dataset, one admin, and demo tickets. */
export function seedIfEmpty() {
  if ((db.prepare("SELECT COUNT(*) c FROM users").get() as any).c > 0) return;
  const data = JSON.parse(
    fs.readFileSync(
      new URL("../seed/bookleaf_sample_data.json", import.meta.url),
      "utf8",
    ),
  );
  const authorHash = bcrypt.hashSync(DEMO_AUTHOR_PASSWORD, 8);
  const insUser = db.prepare(
    "INSERT INTO users (id,email,password_hash,role,name,phone,city,joined_date) VALUES (?,?,?,?,?,?,?,?)",
  );
  const insBook =
    db.prepare(`INSERT INTO books (book_id,author_id,title,isbn,genre,publication_date,status,mrp,royalty_per_copy,copies_sold,
    royalty_earned,royalty_paid,royalty_pending,last_payout_date,print_partner,available_on) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  db.exec("BEGIN");
  try {
    insUser.run(
      ADMIN.id,
      ADMIN.email,
      bcrypt.hashSync(ADMIN.password, 8),
      "admin",
      ADMIN.name,
      null,
      null,
      null,
    );
    for (const a of data.authors) {
      insUser.run(
        a.author_id,
        a.email.toLowerCase(),
        authorHash,
        "author",
        a.name,
        a.phone,
        a.city,
        a.joined_date,
      );
      for (const b of a.books)
        insBook.run(
          b.book_id,
          a.author_id,
          b.title,
          b.isbn,
          b.genre,
          b.publication_date,
          b.status,
          b.mrp,
          b.author_royalty_per_copy,
          b.total_copies_sold,
          b.total_royalty_earned,
          b.royalty_paid,
          b.royalty_pending,
          b.last_royalty_payout_date,
          b.print_partner,
          JSON.stringify(b.available_on),
        );
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  // Demo tickets cover all major categories and edge cases.
  const demoTickets = [
    {
      author_id: "AUTH003",
      book_id: "BK005",
      subject: "No royalty received yet",
      description:
        "My book Between Two Temples has been live since July 2024 and I haven't received any royalty payment at all. What is going on?",
    },
    {
      author_id: "AUTH007",
      book_id: "BK013",
      subject: "Status of Midnight in Mysore",
      description:
        "It has been a while and my thriller is still at cover design. When will it be published?",
    },
    {
      author_id: "AUTH001",
      book_id: "BK001",
      subject: "Wrong ISBN on Amazon",
      description:
        "The ISBN shown on Amazon for Whispers of the Ganges is different from the one printed on my physical copy.",
    },
    {
      author_id: "AUTH009",
      book_id: "BK016",
      subject: "Can I update my author bio?",
      description:
        "I would like to update the author bio on my book listing. How do I do that?",
    },
    ...data.tickets,
  ];
  const t1 = createTicket(demoTickets[0].author_id, {
    bookId: demoTickets[0].book_id,
    subject: demoTickets[0].subject,
    description: demoTickets[0].description,
  });
  for (const t of demoTickets.slice(1))
    createTicket(t.author_id, {
      bookId: t.book_id,
      subject: t.subject,
      description: t.description,
    });
  addMessage(
    t1,
    { id: "AUTH003", role: "author" },
    "Following up - any update on this?",
  );
}

if (process.argv[1]?.endsWith("seed.ts") && process.argv.includes("--reset")) {
  db.exec(
    "DELETE FROM ai_drafts; DELETE FROM messages; DELETE FROM tickets; DELETE FROM books; DELETE FROM users;",
  );
  seedIfEmpty();
  console.log("Database reset and seeded.");
}
