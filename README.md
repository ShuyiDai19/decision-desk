# Decision Desk

**Live:** https://decision-desk.app.space

Decision Desk helps one person research a choice between two or three products for their team, then share a cited decision their teammates can respond to. You name the options and what matters to you. For each option it reads the official site, picks one plan, and fills a comparison table where **every cell quotes the page it came from**. The quotes are then **checked in code** against the page text. You review the table, correct what's wrong, set weights, and freeze the result as a shareable, cited decision brief. Teammates who open it can say whether they agree or have concerns.

The AI drafts and you decide. The interface is built so you can see exactly where the draft might be wrong.

## Try it

1. Open the live site and sign in.
2. Click **Try a ready-made example**. This copies an already-researched comparison into your account, with no waiting and no research cost.
3. Open a cell's **Evidence**, correct a cell (✏️), flag one (🚩), change a criterion's weight and watch the ranking move.
4. Under **Decide**, pick an option and **Finalize**. You get a snapshot with a brief whose `[n]` citations link to the supporting cells. Turn on the share link or email it.
5. Open the link with a second account: it can answer **I agree** or **I have concerns**, and the author sees the responses live.

To run research yourself: **New decision → Use an example → Create → Research these options**. Each signed-in user gets 3 research runs a day.

## How it works

```
create decision ──▶ startResearch (action) ──▶ one background job per option
                                                 │  Exa search, scoped to the official domain
                                                 │  OpenAI extraction: one plan, one claim per criterion
                                                 │  quote check in code (normalised substring match)
                                                 ▼
                    live progress + comparison table (realtime records)
                                                 │  user corrects / flags cells, sets weights
                                                 ▼
                    finalizeDecision (action) ──▶ frozen snapshot + cited brief
                                                 ├─▶ read-only share link (/s/:id)
                                                 ├─▶ email (self + up to 3 teammates)
                                                 └─▶ teammates respond: agree / concerns (author sees all)
```

### What "Quote verified" means
The model must copy a short quote (20–200 characters) verbatim from the page that supports its answer. `src/research/verify.ts` then checks that the quote actually appears in that page's text. It ignores only case, whitespace, quote and dash styles, and a trailing period. If the quote isn't there, the cell says **Needs checking**.

It proves the quote exists. **It does not prove the summary is right.** The model can attach a real quote to a wrong conclusion. That's why every cell shows its evidence, and why correcting and flagging are first-class features.

## DeepSpace: what's used and why

| Piece | Used for |
|---|---|
| **Auth** (Google sign-in) | Every decision belongs to a user; signed-out visitors only see shared snapshots. |
| **Records + per-collection RBAC** | 8 collections. The browser never creates or deletes rows. It may only update listed fields on its own rows (`writableFields`), so a user can correct a cell's value but can't edit its quote, source or badge. Feedback uses `ownerField` + `collaboratorsField`, so the author reads every response and a teammate only their own. |
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
src/pages/            landing (/), decisions, /decisions/new, /decisions/:id, /s/:id
notes/log.md          build log: what the agent did, what I verified, what changed
```

## Run locally

Requires Node 22.15+ (or 24 / 26) and npm 11.6+.

```bash
npm install
npx deepspace auth login
npx deepspace dev start      # http://localhost:5173
npm run test:unit            # unit tests
npx tsc --noEmit             # type check
```

Under `deepspace dev` the research limit is raised to 50/day so you can test with several accounts. The deployed limits are 3/day per user and 20/day for the app owner.

## Tests

Unit tests cover the parts where a silent bug would mislead a user:
- weighted scoring
- input validation
- quote verification
- search planning
- model-output parsing
- the full research pipeline, against a fake store and scripted Exa/OpenAI replies
- snapshot freezing and the brief's citations, HTML escaping and fallback
- teammate feedback validation
- email recipients and the email link origin
- copying the sample, and deleting a decision with everything it owns

## Known limitations

- **Quote verified ≠ correct.** See above. Most remaining errors are a real quote attached to a wrong conclusion (for example, a cheaper plan's price). The review step is the mitigation.
- **Model output varies between runs.** The one-plan-per-option rule helps, but a column can still mix plans.
- **Some quotes contain clutter** from page text extraction, such as glued words or markdown markers.
- **Shared links:** public snapshots can be listed by anyone, not just the one they were linked to. IDs are unguessable and snapshots hold only public product facts.
- **Copied samples** may show columns in a different order.
- **Team feedback is private to the author:** teammates see only their own response, not each other's. That keeps comments private, but the team can't see a shared tally.

## Next steps

- Let users attach their own source to a cell, verified the same way as AI quotes.
- Full team review: invite teammates into a decision to correct cells and set their own weights, and show where they disagree. Today they can only respond to the finished decision.
- A weekly job that re-reads pricing pages and flags cells whose quote no longer appears.
- An explicit column order for options.
