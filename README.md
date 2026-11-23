# Decision Desk

**Live:** https://decision-desk.app.space

Decision Desk helps one person research a choice between two or three products for their team, then share a cited decision their teammates can respond to. You name the options and what matters to you. For each option it searches the official site first, asks the model to compare a single plan, and fills a comparison table that **shows the quote and source behind each answer** where one was found. The quotes are then **checked in code** against the page text, and anything that fails the check, or wasn't found at all, is marked as such. You review the table, correct what's wrong, set weights, and freeze the result as a shareable, cited decision brief. Teammates who open it can say whether they agree or have concerns.

The AI drafts and you decide. The interface is built so you can see exactly where the draft might be wrong.

## Try it

1. Open the live site and sign in.
2. Click **Try a ready-made example**. This copies an already-researched comparison into your account, with no waiting and no research cost.
3. Open a cell's **Evidence**, correct a cell (✏️), flag one (🚩), change a criterion's weight and watch the ranking move.
4. Under **Decide**, pick an option and **Finalize**. You get a snapshot with a brief whose `[n]` citations link to the supporting cells. Turn on the share link or email it.
5. Open the link with a second account: it can answer **I agree** or **I have concerns**, and the author sees the responses live.

To run research yourself: **New decision → Use an example → Create → Research these options**. Each signed-in user gets 3 research runs a day; see **Costs and limits**.

## How it works

```
create decision ──▶ startResearch (action) ──▶ one background job per option
                                                 │  Exa search, official domain first
                                                 │  OpenAI extraction: asked for one plan, one claim per criterion
                                                 │  quote check in code (normalised substring match)
                                                 ▼
                    live progress + comparison table (realtime records)
                                                 │  user corrects / flags cells, sets weights
                                                 ▼
                    finalizeDecision (action) ──▶ frozen snapshot + cited brief
                                                 ├─▶ share link (/share/<token>), readable by link only
                                                 ├─▶ email (self + up to 3 teammates)
                                                 └─▶ teammates respond: agree / concerns (author sees all)
```

### What "Quote verified" means
The model must copy a short quote (20–200 characters) verbatim from the page that supports its answer. `src/research/verify.ts` then checks that the quote actually appears in that page's text. It ignores only case, whitespace, quote and dash styles, and a trailing period. If the quote isn't there, the cell says **Needs checking**.

It proves the quote exists. **It does not prove the summary is right.** The model can attach a real quote to a wrong conclusion. That's why the evidence is shown next to each answer, and why correcting and flagging are first-class features.

## Sharing

Sharing is **by link**, not public publishing:

- A snapshot is readable only by its author. Nobody can list or browse other people's snapshots.
- Turning sharing on creates a link with a random 32-character token (`/share/<token>`). The server returns exactly that one snapshot for that token (`GET /api/shared/:token`), without the author's ID.
- **Anyone you give the link to can view the decision, including your question and context, without signing in.** Treat the link like a document link: only send it to people who should see it.
- Turning sharing off disables the link. Turning it on again creates a new link, so old links never work again. Emailing a brief turns sharing on and includes the link.
- Teammates' feedback needs the current link's token, not just the snapshot ID.

## Costs and limits

**Who pays.** Every paid call is billed to the **app owner's** DeepSpace account, never to the person using the app. That's the platform's default "developer" billing; `src/integrations.ts` doesn't change it for Exa, OpenAI or email. Calls are charged at the provider's price plus a DeepSpace fee, and an email cost about $0.013 when this was built. Paid calls are made only by server actions and background jobs, never from the browser, and every one of them requires a signed-in user.

**What one research run is.** One click of **Research these options** (or **Research again**) is one run. It researches the whole decision: one background job per option, so at most 3 jobs. Each job makes:
- 2 Exa searches, with page text
- 1 more Exa search, only if no website was given, to find the official site
- 1 OpenAI extraction call, capped at 3,000 output tokens

**Daily limit.** 3 runs per user per UTC day, and 20 for the app owner. The platform doesn't rate-limit Exa or OpenAI calls, so this cap is the app's only spending guard. Under `deepspace dev` the cap is 50, so you can test with several accounts.

| Action | Uses a run? | Paid calls |
|---|---|---|
| Research these options / Research again | Yes | Up to 3 jobs, as above |
| Automatic retry of a failed job (once) | No | The job's calls again |
| **Retry this option** on a failed option | No | That one job's calls again |
| Finalize | No | 1 OpenAI call for the brief, capped at 1,200 output tokens |
| Email the brief | No | 1 email (up to 4 recipients); once per version |
| Try a ready-made example, corrections, weights, feedback, delete | No | None |

Retries don't count against the limit, because a failure isn't the user's fault. They still cost money. Two things bound that cost: automatic retry happens at most once per job, and manual retry is only offered for an option whose research has failed.

**Email turns sharing on.** The email contains the decision's share link, so sending it turns sharing on if it was off. Anyone the email reaches, including anyone it's forwarded to, can open the decision, with its question and context, without signing in. Turning sharing off afterwards disables that link too.

## DeepSpace: what's used and why

| Piece | Used for |
|---|---|
| **Auth** (Google sign-in) | Every decision belongs to a user; signed-out visitors only see shared snapshots. |
| **Records + per-collection RBAC** | 8 collections. The browser never creates or deletes rows. It may only update listed fields on its own rows (`writableFields`), so a user can correct a cell's value but can't edit its quote, source or badge. Feedback uses `ownerField` + `collaboratorsField`, so the author reads every response and a teammate only their own. Snapshots are owner-only; see **Sharing** below. |
| **Realtime sync** | Research progress and table updates appear live via `useQuery`; no polling. |
| **Server actions** | Everything that needs validation or spends money: create, start research, finalize, share, email, feedback, sample copy. Actions run with RBAC off, so each one checks ownership itself. |
| **Background jobs** | One `research.candidate` job per option, with one automatic retry. Work outlives the request, and a failed option can be retried alone. |
| **Integration: Exa** (`exa/search`) | Finds official pages and returns their text. That text is what quotes are checked against. |
| **Integration: OpenAI** (`openai/chat-completion`) | Extracts one plan and one claim per criterion, and writes the decision brief. There's no JSON-schema mode, so replies are validated with zod and retried. |
| **Integration: Email** (`email/send`) | Sends the finalized brief. Recipients are confirmed on screen; reply-to is the author. |

**Not used, on purpose:**
- **Stripe:** nothing to sell.
- **LiveKit:** no live audio or video in this workflow.
- **Managed knowledge:** each decision reads a handful of fresh pages, and the quote check needs the exact page text, not retrieved chunks.
- **Yjs co-editing:** one person edits a decision; teammates respond to the finished result instead (see Next steps).
- **Cron:** nothing recurring yet. Re-checking prices weekly would be the first use.

## Code map

```
src/schemas/          8 collections + shared ownerOnly() permission helper
src/actions/          createDecision, deleteDecision, startResearch, finalize/share/email, feedback, sample
src/jobs.ts           research.candidate job → src/research/run-candidate.ts
src/research/         search planning, extraction prompt + parsing, quote verification
src/lib/score.ts      weighted scoring (shared by the page and the snapshot)
src/lib/brief.ts      snapshot freezing, brief prompt, citation parsing, email rendering
src/components/       comparison table, cells, research controls, snapshot views
src/pages/            landing (/), decisions, /decisions/new, /decisions/:id, /s/:id (owner), /share/:token
src/server/share-routes.ts  GET /api/shared/:token, the only public read of a snapshot
notes/log.md          build log: what the agent did, what I verified, what changed
```

## Run locally

Requires Node 22.15+ (or 24 / 26). npm 11.6+ is required to scaffold a new DeepSpace app; installing this repo also worked with npm 10.9.

```bash
git clone https://github.com/ShuyiDai19/decision-desk.git
cd decision-desk
npm ci
npx deepspace auth login      # opens a browser; GitHub or Google sign-in
npx deepspace dev start       # http://localhost:5173
```

No API keys or `.env` file are needed. Exa, OpenAI and email go through the DeepSpace integration proxy, billed to the app owner. `npx deepspace dev start` writes a `.dev.vars` file with the platform values it needs: auth keys, owner ID and owner token. That file is git-ignored and rewritten on every run, so don't edit it or commit it. This app defines no secrets of its own. If it needed one, it would go in the app's secret store with `npx deepspace secrets set KEY`, not in the repo.

## Deploy

The deployed app is already registered under the author's account (`DEEPSPACE_APP_ID` in `wrangler.toml`), so a plain deploy only works for that account:

```bash
git add -A && git commit -m "…"   # deploy refuses uncommitted changes
npx deepspace deploy              # → https://decision-desk.app.space
npx deepspace releases            # what's live; `npx deepspace rollback <id>` to go back
```

To deploy **your own copy** under your own account:

```bash
npx deepspace auth login
npx deepspace app init --new-id     # new app id: separate data, secrets and registration
# edit `name` (and APP_NAME) in wrangler.toml to an unused name, e.g. "decision-desk-yourname"
git add -A && git commit -m "Fork as my own app"
npx deepspace deploy                # → https://<your-name>.app.space
```

Your copy starts empty. Sign in, create and research a decision, then click **Use as the reviewers' sample** on it so **Try a ready-made example** works for others. As the owner, you pay for its research and email.

**What was actually run:**
- **From a clean clone (Nov 22, 2026):** `npm ci`, `npm run type-check`, `npm run lint` and `npm run test:unit` (96 passing).
- **In the original working copy:** `auth login`, `dev start` and `deploy`, which is how the live site was deployed.
- **Not tried:** the `--new-id` fork path. Those steps come from the CLI's own `--help`.

## Tests

### Automated

| Command | What it does |
|---|---|
| `npm run test:unit` | Vitest unit tests: 93 for this app, plus 3 that came with the DeepSpace scaffold |
| `npm run type-check` | TypeScript check (`tsc --noEmit`) |
| `npm run lint` | ESLint over the whole repo |
| `npm run validate` | Type check and unit tests together |

What the unit tests cover, where a silent bug would mislead a user:
- weighted scoring
- input validation
- quote verification
- search planning
- model-output parsing
- snapshot freezing and the brief's citations, HTML escaping and fallback
- share tokens and the shared-snapshot lookup (one snapshot per token, nothing once sharing is off)
- teammate feedback validation
- email recipients and the email link origin
- copying the sample, and deleting a decision with everything it owns
- the research pipeline end to end (search → extract → verify → save, retries, keeping user corrections)

**None of these tests call a real service.** The research pipeline test runs against an in-memory fake record store, with scripted Exa and OpenAI replies. Nothing in the automated suite checks the real Exa, OpenAI or email integrations, or the platform's permission rules (RBAC). Those were checked by hand; see below.

The Playwright end-to-end suites that came with the scaffold (`npm test`, files in `tests/`) were not maintained or run for this project.

### Manual checks

Run with two Google accounts on the local dev server (`deepspace dev`), against the real Exa, OpenAI and email integrations, on Nov 21–22, 2026, unless noted. Details and the problems they turned up are in [`notes/log.md`](notes/log.md).

- **Platform:** a throwaway job showed that a server action can queue a job, and that the job's record writes reach the page live.
- **Research (also on the live site, Nov 22):**
  - options move through their statuses on their own, and the table fills in
  - "Quote verified" quotes were found on their source pages with Cmd+F
  - a "Needs checking" quote was confirmed to be missing from its page
- **Server-side limits:** calling the create action from the browser console with 4 options was rejected.
- **Two-account isolation:** a second account gets "not found" for my decisions, and can't open my snapshots by ID.
- **Review:**
  - corrections survive a research re-run
  - flags and weights update the summary and ranking immediately
  - corrected cells drop the AI's badge
- **Snapshots:**
  - later edits don't change them
  - `[n]` citations land on the cells that support the sentence
- **Sharing:**
  - a link opens signed out
  - turning sharing off kills the link
  - turning it on again gives a new link, and the old one stays dead
- **Email:** it arrives, and its link opens the shared decision.
- **Failure recovery:** with an invalid model name, each option failed with a readable message and a Retry button. After restoring the name, Retry completed.
- **Delete:** removes the decision with its snapshots, whose links stop working. The reviewers' sample can't be deleted, and Delete is disabled while research runs.
- **Team feedback:**
  - a second account's response reaches the author live
  - changing it updates the same entry
  - signed-out visitors are asked to sign in
- **Mobile:** layout checked at phone width in Chrome DevTools.
- **Secrets:** none in tracked files or git history.

### Final check on the live site

Done on https://decision-desk.app.space after the last deploy, Nov 22, 2026, with two accounts:

- [x] The reviewers' sample is set, and "Try a ready-made example" works for a second account
- [x] A share link opens signed out, and turning sharing off kills it
- [x] An emailed brief's link opens on the live site
- [x] Team feedback from a second account reaches the author
- [x] Deleting a test decision works

## Known limitations

- **Quote verified ≠ correct.** See above. Most remaining errors are a real quote attached to a wrong conclusion (for example, a cheaper plan's price). The review step is the mitigation.
- **Model output varies between runs.** The one-plan-per-option rule helps, but a column can still mix plans.
- **Some quotes contain clutter** from page text extraction, such as glued words or markdown markers.
- **Copied samples** may show columns in a different order.
- **Team feedback is private to the author:** teammates see only their own response, not each other's. That keeps comments private, but the team can't see a shared tally.

## Next steps

Known correctness gaps first, then new features:

1. **Plan and price consistency.** A column can still mix plans (for example, a cheaper plan's price under a header naming a pricier plan). Check in code that the price quote mentions the plan named for that option, and flag the cell when it doesn't.
2. **Add a new source after correcting a cell.** Today a correction keeps the AI's original evidence. Let the user attach the page that supports their correction, verified the same way as AI quotes.
3. **Explicit option order.** Store a column order on options, as criteria already have, so copies and reloads always show the same column order.
4. **Team review.** Let teammates into a decision to correct cells and set their own weights, and show where they disagree. Today they can only respond to the finished decision.
5. **Periodic re-research.** A weekly job that re-reads pricing pages and flags cells whose quote no longer appears.
