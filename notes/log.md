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

## Research job

- Agent: `startResearch` action (ownership check, daily quota, one job per option, free retry of a failed option); `research.candidate` job; pipeline in `src/research/` (search → read → extract → verify → save); research controls with live progress and a read-only comparison table on the decision page.
- Agent decisions:
  - Pipeline gets the record store and integrations passed in, so it is tested end to end with fakes (8 tests), plus pure-module tests for quote verification (7), search planning (5) and model-output parsing (7).
  - Quote check is code, not AI: normalised substring match, minimum 15 characters. Model reply validated with zod; bad JSON throws so the platform retries once.
  - Searches use Exa's `includeDomains` with the official domain; if the user gave no website, the domain is picked only when it contains the product name, otherwise unscoped.
  - Re-running never overwrites a claim with origin = 'user'; sources/claims are upserted so retries don't duplicate.
  - `job.attempts` is incremented before each run (read in the SDK source), so "final attempt" = attempts >= maxAttempts.
  - Quota: 3 runs/day per user, 20 for the app owner; retrying one failed option is free.
  - Extraction model `gpt-5.4-mini` (cheaper); switch if quality is poor.
- Agent verified: tsc, eslint, 45/45 unit tests.
- I verified: ran research on the example decision (Help Scout, Zendesk, Freshdesk × 4 criteria). All three options completed; 11 of 12 cells came back "Verified", 1 "Needs checking". Sources were the official sites (helpscout.com, zendesk.com / support.zendesk.com, freshworks.com). Opened several Verified cells' source pages and found each quote with Cmd+F.
- Problems found in the real output, and what changed:
  - "Verified" overclaimed: it proves the quote is on the page, not that the summary is right. Help Scout "$90/month" was the model's own 3 × $30. Zendesk gave a per-agent price ($55) for a "price for 3 agents" criterion ($165, over budget) and still scored 3/5. → Badge renamed "Quote verified" with a tooltip saying what is and isn't checked; prompt now asks for totals with the arithmetic shown and low scores for anything over budget.
  - Help Scout knowledge base "Needs checking": I searched the source page for "Docs is included in all Help Scout plans" and it is NOT there. The flag was correct: the model's quote was not on the page. (Separately, quote matching now ignores a trailing period / leading bullet on the quote, with 2 tests. That was a precaution, not the cause here.)
  - Some quotes have glued words ("annuallyLaunch") from Exa's page text extraction. Cosmetic; left as is because the quote then matches the text we actually hold.
  - Model scores cluster at 4–5, so totals separate weakly. Expected; user corrections and weights are the next step.

- Second run (after the prompt change):
  - Totals now shown with arithmetic: Help Scout 3 × $25 = $75, Zendesk 3 × $19 = $57, Freshdesk 3 × $19 = $57. All 16 cells "Quote verified".
  - New problem: Zendesk's price cell uses the $19 plan, but its knowledge-base cell quotes the Suite Team plan (single help center, ~$55). Each cell is answered on its own, so cells can describe different plans, and the first run used $55. Quotes are real, but the column is inconsistent.
  - Scores went to almost all 5/5 (totals 5, 5, 4.53), so the model's scores barely separate the options.
- Fix for the plan mix-up (my call: fix now rather than leave it to manual edits):
  - The model now picks ONE plan per option (the cheapest that meets the stated requirements), answers every criterion for that plan, and says so when a criterion needs a pricier plan. Stored as `candidates.planBasis` and shown under the option name ("Plan: Suite Team").
  - Score rubric spelled out in the prompt (5 = better than needed … 1 = fails or breaks budget) to spread scores out.
  - New column added per the DeepSpace docs: schema edit + deploy; existing rows get an empty value until re-researched.
  - Agent verified: tsc, eslint, 48/48 tests (plan parsing + plan saved on the candidate), `lintSchemas` clean.
  - I verified (third run): every column now shows its plan: Help Scout "Standard", Zendesk "Suite Team", Freshdesk "Growth". Help Scout and Freshdesk are consistent (all cells use $30/user and $19/agent respectively). Scores spread out: totals 4 / 3.33 / 4 instead of ~5 / 5 / 4.5.
  - Still wrong, so only partly fixed: Zendesk's header says Suite Team but its price cell is 3 × $19 = $57 (a cheaper plan's price; Suite Team is about $55/agent). That cell scores 2/5 while its own rationale says it is under budget. Help Scout's knowledge-base value says "2 Docs sites", but the verified quote doesn't mention a number.
  - Checked against Zendesk's own pricing page: Support Team $19/agent/month (yearly), Suite Team $55, Suite Professional $115; the Knowledge Base appears among the features Suite Team adds on top of Support Team. So the correct answer is Suite Team at 3 × $55 = $165/month, over the ~$100 budget; the AI's $57 came from the Support Team price.
  - Conclusion: prompt rules reduce but don't remove these errors, and "Quote verified" cannot catch a correct quote attached to a wrong conclusion. I stopped prompt-tuning here; the fix for residual errors is the review step (correct a cell, flag it), which is the product's core idea anyway.

## Review: correct, flag, re-weight

- Agent: `ClaimCell` (correct value + score + optional note; flag toggle), weight picker (1–5) on each criterion with instant re-ranking, "Leading" badge on the top option, review summary above the table (cells needing checking / flagged / corrected).
- Agent decisions:
  - Browser writes directly with `useMutations().putConfirmed`; the schema's `writableFields` (claims: value, score, rationale, origin, flagged; criteria: weight, description) is what stops edits to quotes, sources or verification. No server action needed for these.
  - A correction sets origin = 'user', so research re-runs keep it (already covered by a pipeline test).
  - Weights update the ranking immediately from local state, then save; the ranking uses the same `score.ts` as the server.
  - No "Leading" badge on a tie at the top.
- Agent verified: tsc, eslint.
- I verified: corrected Zendesk's price to "$165/month for 3 agents, billed yearly", score 2 → cell shows "Corrected by you", summary shows "1 corrected by you", and the correction was still there after research ran again (other cells' sources re-read Nov 22). Flagged Help Scout's knowledge-base cell (its "1 Docs site" value isn't backed by a number in the quote) → orange outline and "1 flagged by you". Set weights Price 1, Knowledge base 4, Email 4, Setup 5 → totals updated at once: Help Scout 4.36 (Leading), Freshdesk 4, Zendesk 3.86.
- Problems I found, fixed:
  - A corrected cell still showed "Quote verified", but that quote ($19/agent) backs the AI's old value, not my $165. → Corrected cells now show only "Corrected by you", and the evidence is labelled "Original AI evidence".
  - Flag/edit icons wrapped onto their own line in narrow columns. → Badges wrap; icons stay pinned top-right.
- Cosmetic, left as is: some quotes include markdown from Exa's page text (e.g. "- ##### Email Manage customer emails as a team.").
- Hit while testing: "research limit reached" after ~5 runs. Cause: I was signed into the app with a different Google account from the one that owns the app (the CLI / deploy account), so I got the normal 3-runs/day user limit instead of the owner's 20. The quota worked as designed.
- Fix: under `deepspace dev` (detected by ALLOW_DEBUG_ROUTES=true, which only local dev sets) the research limit is 50/day for anyone, so testing with a second account isn't blocked. Deployed limits unchanged: 3/day per user, 20 for the owner.

## Finalize, share, email

- Agent: `finalizeDecision` / `setSnapshotVisibility` / `emailSnapshot` actions (`src/actions/finalize.ts`); pure snapshot + brief module `src/lib/brief.ts` (9 tests); recipient parsing `src/lib/recipients.ts` (4 tests); "Decide" panel with saved versions on the decision page; snapshot page `/s/:id` with brief, frozen table and owner share/email controls.
- Agent decisions:
  - The snapshot freezes everything (cells, quotes, sources, weights, scores) as JSON, so shared links and emails never change when the working decision is edited. Re-finalizing makes version 2.
  - The brief is generated only from the frozen table; every fact must cite a numbered cell like [3], which links to that cell (and in email, to its source). Citations to non-existent cells, links and HTML are stripped. Flagged / needs-checking cells must go under "Still to verify".
  - If the AI brief fails, a template brief is used, so finalizing never blocks on the model.
  - The chosen option defaults to the leader but the user can pick any; open items prompt a confirmation, not a block.
  - Email: self + up to 3 teammates, confirmed on screen first; sending turns on the share link (the email links to it); one send per version; reply-to is the author.
  - Known tradeoff (from the design): 'published' lets signed-out visitors list all public snapshots, not just the linked one. IDs are unguessable and nothing sensitive is stored.
- Hit while testing: the email's "See the full comparison" link gave a 404. Cause: I sent it from the local dev server, but the link pointed at the deployed site, which didn't have the /s/ page yet (not deployed) and doesn't have local data anyway. → Emails now link to the origin the page was opened on, accepted only if it is localhost or the deployed app; anything else falls back to the deployed app so links can't be pointed elsewhere (3 tests).
- Agent verified: tsc, eslint, 64/64 unit tests.
- I verified: _(finalize with an open item → confirm dialog → snapshot page; [n] citations jump to cells; link off → private window says unavailable; link on → private window shows it signed out; email arrives with working source links and "See the full comparison"; editing the decision afterwards doesn't change the snapshot)_
