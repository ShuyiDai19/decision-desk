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

## Data model and scoring

- Agent: wrote the 7 collections in `src/schemas/` with a shared `ownerOnly()` permission helper, and `src/lib/score.ts` with 10 unit tests.
- Agent decisions I should be able to explain:
  - Clients never create or delete rows; actions and jobs do. Clients only update listed fields on their own rows.
  - `sources` / `claims` use an explicit `ownerId` (not `userBound`) because jobs run as the app owner.
  - Users cannot write `verification`, `quote` or `sourceId`, so an edited cell can't pose as a verified quote.
  - Total score is computed in code; missing scores are excluded and coverage (e.g. 3/5) is shown.
- Agent verified: `tsc --noEmit` and eslint pass; 10/10 score tests pass.
- I verified: `npx deepspace dev start` reported no schema warnings; `npm run test:unit` on my Mac passed 13/13 (10 scoring + 3 scaffold tests). The permission test is recorded under "Create a decision" below.

## Create a decision

- Agent: `createDecision` server action, shared validation (`src/lib/decision-input.ts`, 8 tests), `/decisions/new` form with an "Use an example" button, decision list on `/home`, read-only `/decisions/:id`.
- Agent decisions:
  - The same validation runs in the form and in the action; only the action's check counts.
  - No multi-row transactions in the record room, so the action deletes what it wrote if a later write fails.
  - Field errors travel in the SDK's `details` field rather than an invented one.
  - Requires 2–3 options (a comparison of one is meaningless) and 1–5 criteria.
- Agent verified: tsc, eslint, 18/18 unit tests, `lintSchemas` on all collections: no warnings.
- I verified: created a decision with the example → landed on its page with 3 options and 4 criteria, and it appears on my Decisions list. Called `createDecision` directly from the browser console with 4 options → `success: false`, `invalid_input`, "Compare at most 3 options", no decision created. Opened my decision URL in a private window signed in as a second account → "Decision not found" and an empty Decisions list.
- Hit along the way: `/decisions/new` returned 404 until I restarted the dev server; it was started before the new page files existed. Not a code bug.
