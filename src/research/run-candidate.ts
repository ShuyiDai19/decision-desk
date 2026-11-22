/**
 * Research one candidate: search → read pages → extract → verify → save.
 *
 * Runs inside the `research.candidate` background job (src/jobs.ts). The
 * record store and integrations are passed in as `deps`, so this file has no
 * platform imports and can be tested with fakes (run-candidate.test.ts).
 *
 * Safe to re-run (the job retries once on error): sources are upserted by
 * (candidate, url) and claims by (candidate, criterion), and claims a user
 * has corrected (origin = 'user') are never overwritten.
 */

import { buildMessages, parseExtraction, RESEARCH_MODEL, type ExtractionPage } from './extract'
import { hostnameOf, pickOfficialDomain, planQueries, siteDomain } from './search'
import { quoteAppearsIn } from './verify'
import type { Decision } from '../schemas/decisions-schema'
import type { Criterion } from '../schemas/criteria-schema'
import type { Candidate, ResearchStatus } from '../schemas/candidates-schema'
import type { Source } from '../schemas/sources-schema'
import type { Claim, Verification } from '../schemas/claims-schema'

export const MAX_PAGES = 4
const RESULTS_PER_QUERY = 3
const PAGE_TEXT_CHARS = 8000

type Row<T> = { recordId: string; data: T }

export interface ResearchDeps {
  records: {
    query(collection: string, opts?: { where?: Record<string, unknown>; limit?: number }): Promise<unknown[]>
    create(collection: string, data: Record<string, unknown>): Promise<unknown>
    update(collection: string, recordId: string, data: Record<string, unknown>): Promise<unknown>
  }
  callIntegration(endpoint: string, params: Record<string, unknown>): Promise<unknown>
  progress(value: number, message: string): void
  now(): Date
}

export type ResearchPayload = { decisionId: string; candidateId: string }

const rows = <T>(list: unknown[]) => list as Row<T>[]

async function getById<T>(deps: ResearchDeps, collection: string, recordId: string): Promise<Row<T> | undefined> {
  const found = rows<T>(await deps.records.query(collection, { where: { recordId }, limit: 500 }))
  return found.find((r) => r.recordId === recordId)
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

type ExaResult = { url?: string; title?: string; text?: unknown }

async function exaSearch(deps: ResearchDeps, params: Record<string, unknown>): Promise<ExaResult[]> {
  const data = (await deps.callIntegration('exa/search', params)) as { results?: ExaResult[] }
  return Array.isArray(data?.results) ? data.results : []
}

async function setCandidate(deps: ResearchDeps, candidateId: string, status: ResearchStatus, progressNote = '', error = '') {
  await deps.records.update('candidates', candidateId, { researchStatus: status, progressNote, error })
}

/** Marks the decision ready to review once no candidate is still being researched. */
export async function finishDecisionIfSettled(deps: ResearchDeps, decisionId: string) {
  const candidates = rows<Candidate>(await deps.records.query('candidates', { where: { decisionId }, limit: 10 }))
  const settled = candidates.every((c) => c.data.researchStatus === 'done' || c.data.researchStatus === 'failed')
  if (settled) await deps.records.update('decisions', decisionId, { status: 'reviewing' })
}

export async function researchCandidate(payload: ResearchPayload, deps: ResearchDeps): Promise<{ claims: number; verified: number; pages: number }> {
  const { decisionId, candidateId } = payload

  // 1. Load what the job needs. The action that enqueued this already checked ownership.
  const decision = await getById<Decision>(deps, 'decisions', decisionId)
  const candidate = await getById<Candidate>(deps, 'candidates', candidateId)
  if (!decision || !candidate || candidate.data.decisionId !== decisionId) {
    throw new Error('Decision or candidate no longer exists')
  }
  const ownerId = decision.data.ownerId
  const criteria = rows<Criterion>(await deps.records.query('criteria', { where: { decisionId }, limit: 10 }))
    .sort((a, b) => a.data.order - b.data.order)
  const name = candidate.data.name

  // 2. Search, scoped to the official site when we can tell what it is.
  await setCandidate(deps, candidateId, 'searching', 'Finding official pages')
  deps.progress(0.1, 'Searching')
  let domain = candidate.data.homepageUrl ? siteDomain(candidate.data.homepageUrl) : ''
  if (!domain) {
    const found = await exaSearch(deps, { query: `${name} official website`, numResults: 5, type: 'auto' })
    domain = pickOfficialDomain(name, found.map((r) => r.url ?? ''))
  }

  const pages: ExtractionPage[] = []
  const seen = new Set<string>()
  for (const q of planQueries(name, criteria.map((c) => c.data.name), domain)) {
    const results = await exaSearch(deps, {
      ...q,
      numResults: RESULTS_PER_QUERY,
      type: 'auto',
      contents: { text: { maxCharacters: PAGE_TEXT_CHARS } },
    })
    for (const r of results) {
      const url = (r.url ?? '').trim()
      if (!url || seen.has(url) || pages.length >= MAX_PAGES) continue
      seen.add(url)
      pages.push({ url, title: (r.title ?? hostnameOf(url)).slice(0, 300), text: typeof r.text === 'string' ? r.text : '' })
    }
  }

  // 3. Record every page read, so each claim can link to its source.
  const fetchedAt = deps.now().toISOString()
  const existingSources = rows<Source>(await deps.records.query('sources', { where: { candidateId }, limit: 50 }))
  const sourceIds: string[] = []
  for (const p of pages) {
    const data = {
      title: p.title,
      fetchedAt,
      contentHash: p.text ? await sha256Hex(p.text) : '',
      fetchOk: p.text ? 1 : 0,
    }
    const prior = existingSources.find((s) => s.data.url === p.url)
    if (prior) {
      await deps.records.update('sources', prior.recordId, data)
      sourceIds.push(prior.recordId)
    } else {
      const created = (await deps.records.create('sources', {
        ...data,
        decisionId,
        candidateId,
        ownerId,
        url: p.url,
        origin: 'search',
      })) as { recordId: string }
      sourceIds.push(created.recordId)
    }
  }

  // 4. Extract one claim per criterion (only from pages that have text).
  await setCandidate(deps, candidateId, 'extracting', `Reading ${pages.length} page${pages.length === 1 ? '' : 's'}`)
  deps.progress(0.5, 'Extracting')
  const readable = pages.map((p, i) => ({ page: p, sourceId: sourceIds[i] })).filter((x) => x.page.text)
  let planBasis = ''
  let extracted = criteria.map((c) => ({
    criterionId: c.recordId,
    value: null as string | null,
    score: null as number | null,
    rationale: 'No readable official pages were found.',
    sourceIndex: null as number | null,
    quote: null as string | null,
  }))
  if (readable.length > 0) {
    const reply = (await deps.callIntegration('openai/chat-completion', {
      model: RESEARCH_MODEL,
      max_tokens: 3000,
      messages: buildMessages({
        productName: name,
        question: decision.data.question,
        context: decision.data.context,
        criteria: criteria.map((c) => ({ id: c.recordId, name: c.data.name, description: c.data.description })),
        pages: readable.map((x) => x.page),
      }),
    })) as { choices?: { message?: { content?: string } }[] }
    const content = reply?.choices?.[0]?.message?.content
    if (typeof content !== 'string') throw new Error('Model returned no content')
    const parsed = parseExtraction(content, criteria.map((c) => c.recordId), readable.length)
    extracted = parsed.claims
    planBasis = parsed.plan ?? ''
  }

  // 5. Verify each quote against the page text, in code.
  deps.progress(0.8, 'Verifying quotes')
  const existingClaims = rows<Claim>(await deps.records.query('claims', { where: { candidateId }, limit: 20 }))
  let verified = 0
  for (const e of extracted) {
    const prior = existingClaims.find((c) => c.data.criterionId === e.criterionId)
    if (prior?.data.origin === 'user') continue // never overwrite a user's correction

    const source = e.sourceIndex !== null ? readable[e.sourceIndex] : undefined
    let verification: Verification = 'not_found'
    if (e.value !== null) {
      verification = source && e.quote && quoteAppearsIn(e.quote, source.page.text) ? 'verified' : 'unverified'
    }
    if (verification === 'verified') verified += 1

    const data = {
      value: e.value ?? '',
      score: e.score ?? 0,
      rationale: e.rationale,
      sourceId: source?.sourceId ?? '',
      quote: e.quote ?? '',
      verification,
      origin: 'ai',
      flagged: 0,
    }
    if (prior) await deps.records.update('claims', prior.recordId, data)
    else await deps.records.create('claims', { ...data, decisionId, candidateId, criterionId: e.criterionId, ownerId })
  }

  // 6. Done.
  await deps.records.update('candidates', candidateId, {
    researchStatus: 'done',
    progressNote: `${verified} of ${extracted.length} verified from ${pages.length} pages`,
    error: '',
    planBasis,
  })
  deps.progress(1, 'Done')
  await finishDecisionIfSettled(deps, decisionId)
  return { claims: extracted.length, verified, pages: pages.length }
}

/**
 * Called when an attempt throws. On the last attempt the candidate is marked
 * failed (and the decision may become reviewable); otherwise it shows that a
 * retry is coming.
 */
export async function recordFailure(deps: ResearchDeps, payload: ResearchPayload, err: unknown, finalAttempt: boolean) {
  const message = (err instanceof Error ? err.message : String(err)).slice(0, 500)
  if (finalAttempt) {
    await setCandidate(deps, payload.candidateId, 'failed', '', message)
    await finishDecisionIfSettled(deps, payload.decisionId)
  } else {
    await setCandidate(deps, payload.candidateId, 'queued', 'Retrying after an error', message)
  }
}
