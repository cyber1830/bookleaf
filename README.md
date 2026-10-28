# BookLeaf Author Support & Communication Portal

Two portals (author + admin) on one Node/TypeScript service with AI-assisted triage and reply drafting.
**Confidential assignment: keep this repository private.**

## Live demo

[https://bookleaf-z7az.onrender.com](https://bookleaf-z7az.onrender.com)

## Demo credentials (pre-seeded with the provided dataset)

| Role                   | Email                                                                                                                                       | Password    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Admin                  | `admin@bookleaf.com`                                                                                                                        | `admin123`  |
| Author (any of the 10) | e.g. `priya.sharma@email.com`, `ananya.reddy@email.com`, `sneha.kulkarni@email.com` (has a book in production), `kavita.deshmukh@email.com` | `author123` |

Eight demo tickets are seeded across royalty, production, ISBN, general, distribution, printing, and payment scenarios.

## Run locally

Requires **Node.js >= 22.13** (uses the built-in `node:sqlite`, so there are no native modules to compile).

```bash
npm install
cp .env.example .env      # add AI_API_KEY (free Groq/Gemini key works); the app works without it
npm run dev               # http://localhost:3000  (DB auto-created and seeded on first start)
npm test                  # unit tests (heuristics, AI output parsing, payout-date facts)
npm run typecheck
npm run seed              # wipe and re-seed the database
```

Deploy (Render/Railway/any VPS): build `npm install`, start `npm start`, set `NODE_ENV=production`, `JWT_SECRET`, `AI_API_KEY` (+ `AI_BASE_URL`/`AI_MODEL`).
The SQLite file lives at `DB_PATH`; without a persistent disk it re-seeds on each deploy (fine for a demo).

## What is included

- Author and admin portals with sign-in/sign-up
- Books, tickets, replies, notes, assignment and status management
- AI classification, priority scoring and Knowledge Base-based drafts
- Rule-based fallback when AI is unavailable
- Real-time updates and private attachment uploads
- REST API with validation and role-based access

## Technical notes

Node.js, TypeScript, Express, SQLite, vanilla JavaScript, SSE and Groq AI.
The AI key is read only from environment variables. Drafts are cached and always reviewed by an admin before sending.

## Known limitations / next steps

- Attachments are stored privately on the server for the demo; production deployment should use S3-compatible storage with signed URLs.
- Passwords are a shared demo value; no rate limiting/lockout on login; SSE token travels in the query string (use short-lived SSE tickets or cookies in production).
- Calendar quarters are assumed for payout-date facts; real bank-details status isn't in the dataset, so drafts say the team will verify it.
- Single process / in-memory SSE hub: scale-out needs Redis pub/sub; move SQLite → PostgreSQL and the triage step into a job queue.
- No AI evaluation harness yet; I'd add a labelled set of tickets to track classification accuracy and draft quality (admin edit-distance on sent drafts is a good signal).
- Frontend is intentionally plain vanilla JS; no automated UI tests.
