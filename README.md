# BookLeaf Author Support & Communication Portal

Two portals (author + admin) on one Node/TypeScript service with AI-assisted triage and reply drafting.
**Confidential assignment: keep this repository private.**

## Demo credentials (pre-seeded with the provided dataset)

| Role                   | Email                                                                                                                                       | Password    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Admin                  | `admin@bookleaf.com`                                                                                                                        | `admin123`  |
| Author (any of the 10) | e.g. `priya.sharma@email.com`, `ananya.reddy@email.com`, `sneha.kulkarni@email.com` (has a book in production), `kavita.deshmukh@email.com` | `author123` |

Four demo tickets are seeded (royalty, production status, ISBN, general).

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

## Architecture

```
public/            vanilla-JS SPA (no build step), served by Express
src/app.ts         Express wiring, middleware order, error handler
src/routes/        thin HTTP layer: auth, author, admin, events (SSE)
src/services/      ticket business rules (ownership, status transitions, queue ordering)
src/ai/            knowledge.ts (KB), llm.ts (client), triage.ts, draft.ts, fallback.ts (rules)
src/{auth,http,schemas,events,db}.ts   JWT/RBAC, errors+validation, zod schemas, SSE hub, schema
```

Key decisions

- **One deployable, SQLite via Node's built-in `node:sqlite`** (no native build step, so installs cleanly on Windows/CI; it is still flagged experimental in Node). Zero-setup for reviewers; schema is plain relational SQL and ports directly to PostgreSQL (see write-up).
- **Thin routes, logic in services.** Routes only validate (zod) and delegate; ownership checks live in one place (`getOwnedRow`).
- **Internal notes are rows in `messages` with `internal=1`;** author queries always filter them out, and author DTOs never include AI metadata.
- **Real time via SSE.** Server pushes `ticket` events (admins: all tickets, authors: only their own); clients refetch the affected view. Simpler than WebSockets and sufficient (one-way). Typed replies are preserved across live refreshes.
- **AI never blocks the ticket flow.** Creation stores a free rule-based classification instantly, then triages asynchronously.
- **Override-safe:** `category_source`/`priority_source` (`ai | heuristic | admin`) record provenance; an AI result can never overwrite an admin override.
- **Author sees only their data:** tickets of other authors return 404 (not 403) so IDs can't be probed.

## AI integration

**Model:** provider-agnostic by design (`src/ai/llm.ts`): any OpenAI-compatible endpoint (Groq, Google Gemini, OpenRouter, Ollama, OpenAI) or Anthropic, selected purely by env vars (`AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`). The default is **Llama 3.3 70B on Groq's free tier**: classification and short, policy-grounded drafts are well within its ability, and it costs nothing for this workload. Smaller models are less reliable at strict JSON, so triage output is extracted and validated against the exact enums, and anything off-spec falls back to the rule-based result. Swapping to a paid model (e.g. Claude Haiku or gpt-4o-mini) for production is a config change, no code change.

**Auto-classification + priority** (`ai/triage.ts`): one call at ticket creation, `max_tokens=150`, JSON output `{category, priority, reason}` validated by zod against the exact enums. Prompt has an explicit priority rubric derived from the KB (ISBN errors always ≥ High, long-overdue royalties Critical, bio updates Low). Input is only subject + truncated description + a one-line book summary.

**Drafted response** (`ai/draft.ts`) is generated when the admin opens a ticket. The prompt is assembled from:

1. system rules (tone, "use only provided facts", no invented royalty maths, plain text, 90-180 words, sign-off);
2. company overview + tone guidelines;
3. **only the policy section for the ticket's category** + **one** few-shot example from BookLeaf's sample responses;
4. the **actual book record** (copies sold, earned/paid/pending, status, dates) so replies cite real numbers; for general queries a compact summary of the author's books;
5. for royalty/general tickets, computed **payout-window dates** (previous/next quarter end + 45 days) so the reply can state specific dates;
6. only the **last 6 public messages**. Internal notes are never sent to the model.

Data-edge handling is explicit in the prompt: books in production (no royalty data), pending below ₹1,000 (rolls over) vs above ₹1,000 with no payout (genuinely overdue → own it, 48h escalation). The dataset stores a flat per-copy royalty rather than the 80/20 net-profit breakdown, so the model is told to quote the per-copy figure and offer a line-by-line statement instead of inventing a calculation.

**Prompt-injection:** ticket text is wrapped in tags and the system prompt states it is data, not instructions. The model only drafts; a human always reviews before anything is sent.

**Graceful degradation** (`ai/llm.ts`)

- No key / API down / rate-limited / timeout (20s): one retry on 429/5xx, then ticket keeps its rule-based category/priority with `ai_status=failed` (⚠️ in the queue) and an admin "Retry AI triage" button.
- Draft endpoint returns a clear `503 AI_UNAVAILABLE`; the reply box stays usable for manual replies.
- Circuit breaker: 3 consecutive failures pause AI calls for 60s so an outage doesn't add latency.
- Malformed/off-enum model output is rejected and treated as a failure (never stored).
- Startup recovery re-triages tickets left `pending` by a restart; in-flight de-duplication avoids double calls.

**Cost awareness**

- Small model; tight `max_tokens` (150 triage / 450 draft).
- No full KB per call: category-scoped policy + one example (~1K input tokens per draft vs. the whole KB + history).
- History capped to 6 messages × 600 chars; description truncated.
- Drafts are generated **on demand, not per ticket**, and **cached by a hash of the prompt inputs**: reopening a ticket is free; the hash changes only when the thread, category, priority or book data change. Explicit "Regenerate" bypasses it.
- Rule-based classification gives an immediate free result, so the LLM only refines it.
- API key lives only in server env vars; the frontend never sees it. Free-tier rate limits are handled by the same retry/circuit-breaker path, and the cache means repeat opens cost no requests.

## API

Base `/api`. JSON in/out. Errors: `{ "error": { "code", "message", "details?" } }` with 400 (validation), 401, 403, 404, 409, 503 (AI unavailable), never a bare 500 for expected failures. Auth: `Authorization: Bearer <jwt>` (12h).

| Method & path                            | Role   | Description                                                                                                                  |
| ---------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `POST /auth/login`                       | public | `{email,password}` → `{token,user}`                                                                                          |
| `GET /auth/me`                           | any    | current user                                                                                                                 |
| `GET /events?token=`                     | any    | SSE stream of `ticket` events (admin: all; author: own)                                                                      |
| `GET /books`                             | author | own books (`inProduction` flag for unpublished)                                                                              |
| `GET /tickets`                           | author | own tickets + public messages                                                                                                |
| `POST /tickets`                          | author | `{bookId                                                                                                                     | null, subject(3-200), description(10-5000), attachmentName?}` → 201 |
| `GET /tickets/:id`                       | author | own ticket (404 if not yours)                                                                                                |
| `POST /tickets/:id/messages`             | author | follow-up `{body}`; reopens Resolved; 409 if Closed                                                                          |
| `GET /admin/tickets`                     | admin  | filters: `status, category, priority, assigned=me\|unassigned, from, to (YYYY-MM-DD)`; sorted unresolved → priority → oldest |
| `GET /admin/tickets/:id`                 | admin  | ticket, full thread incl. internal notes, book record                                                                        |
| `PATCH /admin/tickets/:id`               | admin  | any of `status, category, priority, assignedTo ("me"\|null)`; category/priority marks `admin` override                       |
| `POST /admin/tickets/:id/reply`          | admin  | `{body, status?}`; visible to author; Open→In Progress, auto-assigns                                                         |
| `POST /admin/tickets/:id/notes`          | admin  | internal note (never shown to author)                                                                                        |
| `GET /admin/tickets/:id/draft?refresh=1` | admin  | AI draft `{draft,cached,model,category}`                                                                                     |
| `POST /admin/tickets/:id/ai/retry`       | admin  | re-run AI triage                                                                                                             |
| `GET /health`                            | public | liveness                                                                                                                     |

## Known limitations / next steps

- Attachments are stored privately on the server for the demo; production deployment should use S3-compatible storage with signed URLs.
- Passwords are a shared demo value; no rate limiting/lockout on login; SSE token travels in the query string (use short-lived SSE tickets or cookies in production).
- Calendar quarters are assumed for payout-date facts; real bank-details status isn't in the dataset, so drafts say the team will verify it.
- Single process / in-memory SSE hub: scale-out needs Redis pub/sub; move SQLite → PostgreSQL and the triage step into a job queue.
- No AI evaluation harness yet; I'd add a labelled set of tickets to track classification accuracy and draft quality (admin edit-distance on sent drafts is a good signal).
- Frontend is intentionally plain vanilla JS; no automated UI tests.
