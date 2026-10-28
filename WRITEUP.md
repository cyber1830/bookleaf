# Write-up: approach, trade-offs, path to production

**What I prioritised.** The ticket lifecycle and the AI integration (25% + the core of the product): author raises a ticket → instant rule-based triage → async LLM triage → admin sees a sorted queue, an AI draft grounded in BookLeaf policy and the author's real book record, edits and sends → author sees the reply live. Security basics (JWT, role middleware, per-author ownership, secrets in env) and the dataset's edge cases (books in production, ₹0 payouts, ₹850 below the ₹1,000 payout minimum) were treated as requirements, not extras.

**Key trade-offs.**
- *One process, SQLite, vanilla JS, SSE.* Fast to run and review, no infra; costs horizontal scalability and polish.
- *Drafts on demand + cached*, not generated for every ticket: lower spend, slight latency when an admin first opens a ticket.
- *Rule-based first, AI second.* The queue is useful instantly and survives AI outages; the cost is a brief window where a ticket shows a provisional category.
- *Free-tier model behind a provider-agnostic client* (Llama 3.3 70B on Groq by default): zero cost, swappable by config; trade-off is weaker JSON discipline, mitigated by validation + fallback.
- *Small model + scoped context* instead of dumping the whole KB: cheaper and less noisy, but relies on correct classification to pick the right policy slice (admins can override and regenerate).
- *Human in the loop always.* The AI never sends anything; it drafts, and admins own the reply.

**Evolving to production.** PostgreSQL + migrations; job queue (BullMQ/SQS) for triage with retries and dead-lettering; Redis pub/sub for SSE across instances; real file uploads (S3); proper auth (per-user passwords, rate limiting, optional SSO for admins, audit log); retrieval over the full knowledge base as it grows, plus prompt caching for the static system/KB prefix; structured-output/tool-use for triage; an evaluation set and dashboards (classification accuracy, override rate, draft edit distance, cost per ticket); SLA timers and escalation rules (e.g. auto-bump Critical tickets idle >24h); integration with the royalty/production systems so drafts use live bank-link and stage data rather than a snapshot.
