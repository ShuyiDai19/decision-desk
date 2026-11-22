# Work log

Each entry: what the agent did · what I verified myself · what I changed or overruled.

## Setup and platform checks (2026-11-21)

**Setup**
- Agent: diagnosed the scaffold failure (npm 10.9.3 < required 11.6.0; new npm installed to ~/.npm-global/bin but not on PATH).
- I: fixed PATH, scaffolded, logged in, registered and deployed. `npx deepspace releases` shows release #1 on commit be7c214.

**Integration checks** (`notes/exa.txt`, `notes/openai.txt`, `notes/email.txt`)
- Exa returns page text via `contents.text`, so the quote check can use Exa's text directly.
- `openai/chat-completion` has no JSON-schema mode → JSON-only prompt + zod validation + retry.
- `email/send` ignores `from` (always notifications@updates.app.space) → use `reply_to`. $0.013 per email.
- Agent read the SDK types: `JobContext` has no record API; jobs can use `buildCronContext(env, ...)`.
- Security: server-action `tools` run with RBAC off → every action must check ownership itself.

**Probe job** (temporary: `probes` schema, `startProbe` action, `probe` job, `/probe` page)
- Agent: wrote it; `tsc --noEmit` and eslint pass.
- I verified locally: clicking the button created a record whose status changed step 1 → 2 → 3 → done on its own over ~6 s, no reload. So a server action can enqueue a job, and a job's record writes reach the page in real time. Main plan holds; no fallback needed.
- Minor: the job list shows `succeeded · 0%` (final progress isn't kept). Real UI will read progress from the record, not the job list.
