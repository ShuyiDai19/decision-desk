import { beforeEach, describe, expect, it } from 'vitest'
import { recordFailure, researchCandidate, type ResearchDeps } from './run-candidate'

type Row = { recordId: string; data: Record<string, unknown> }

/** In-memory stand-in for the record room, with equality `where` like the real one. */
function fakeStore() {
  const tables = new Map<string, Row[]>()
  let n = 0
  const table = (c: string) => tables.get(c) ?? (tables.set(c, []), tables.get(c)!)
  return {
    tables,
    seed(c: string, recordId: string, data: Record<string, unknown>) {
      table(c).push({ recordId, data })
    },
    records: {
      async query(c: string, opts?: { where?: Record<string, unknown> }) {
        return table(c).filter((r) =>
          Object.entries(opts?.where ?? {}).every(([k, v]) => (k === 'recordId' ? r.recordId === v : r.data[k] === v)),
        )
      },
      async create(c: string, data: Record<string, unknown>) {
        const recordId = `${c}-${++n}`
        table(c).push({ recordId, data: { ...data } })
        return { recordId }
      },
      async update(c: string, id: string, data: Record<string, unknown>) {
        const r = table(c).find((x) => x.recordId === id)
        if (!r) throw new Error(`no ${c} ${id}`)
        Object.assign(r.data, data)
        return { recordId: id }
      },
    },
  }
}

const PRICING = 'Standard plan. $25 per user/month, billed annually. Includes a Docs knowledge base for help articles.'

let store: ReturnType<typeof fakeStore>
let calls: { endpoint: string; params: Record<string, unknown> }[]
let modelReply: string

function deps(): ResearchDeps {
  return {
    records: store.records,
    async callIntegration(endpoint, params) {
      calls.push({ endpoint, params })
      if (endpoint === 'exa/search') {
        if (String(params.query).includes('official website')) {
          return { results: [{ url: 'https://www.helpscout.com/', title: 'Help Scout' }] }
        }
        return { results: [{ url: 'https://www.helpscout.com/pricing/', title: 'Pricing', text: PRICING }] }
      }
      return { choices: [{ message: { content: modelReply } }] }
    },
    progress() {},
    now: () => new Date('2026-11-22T12:00:00Z'),
  }
}

beforeEach(() => {
  store = fakeStore()
  calls = []
  store.seed('decisions', 'd1', { ownerId: 'user-1', question: 'Which tool?', context: '$100/month', status: 'researching' })
  store.seed('criteria', 'price', { decisionId: 'd1', name: 'Price', description: '', weight: 5, order: 0 })
  store.seed('criteria', 'kb', { decisionId: 'd1', name: 'Knowledge base', description: '', weight: 3, order: 1 })
  store.seed('criteria', 'email', { decisionId: 'd1', name: 'Email inbox', description: '', weight: 3, order: 2 })
  store.seed('candidates', 'c1', { decisionId: 'd1', name: 'Help Scout', homepageUrl: 'https://www.helpscout.com', researchStatus: 'queued' })
  modelReply = JSON.stringify({
    plan: 'Standard',
    claims: [
      // real quote → verified
      { criterionId: 'price', value: '$25 per user/month', score: 4, rationale: 'Within budget', sourceIndex: 0, quote: '$25 per user/month, billed annually.' },
      // invented quote → needs checking
      { criterionId: 'kb', value: 'Included', score: 5, rationale: 'Docs', sourceIndex: 0, quote: 'Unlimited knowledge bases on every plan' },
      // nothing found
      { criterionId: 'email', value: null, score: null, rationale: 'Not on these pages', sourceIndex: null, quote: null },
    ],
  })
})

const claimsBy = (): Record<string, Record<string, unknown>> =>
  Object.fromEntries((store.tables.get('claims') ?? []).map((r) => [String(r.data.criterionId), r.data]))

describe('researchCandidate', () => {
  it('verifies real quotes, flags invented ones, and marks gaps as not found', async () => {
    const result = await researchCandidate({ decisionId: 'd1', candidateId: 'c1' }, deps())
    expect(result).toEqual({ claims: 3, verified: 1, pages: 1 })
    const c = claimsBy()
    expect(c.price).toMatchObject({ verification: 'verified', score: 4, ownerId: 'user-1', origin: 'ai' })
    expect(c.kb).toMatchObject({ verification: 'unverified' })
    expect(c.email).toMatchObject({ verification: 'not_found', value: '', score: 0, sourceId: '' })
  })

  it('scopes searches to the official domain and stores sources with the owner', async () => {
    await researchCandidate({ decisionId: 'd1', candidateId: 'c1' }, deps())
    const searches = calls.filter((x) => x.endpoint === 'exa/search')
    expect(searches.every((s) => JSON.stringify(s.params.includeDomains) === '["helpscout.com"]')).toBe(true)
    const [source] = store.tables.get('sources')!
    expect(source.data).toMatchObject({ ownerId: 'user-1', fetchOk: 1, url: 'https://www.helpscout.com/pricing/' })
  })

  it('marks the candidate done and the decision ready to review', async () => {
    await researchCandidate({ decisionId: 'd1', candidateId: 'c1' }, deps())
    expect(store.tables.get('candidates')![0].data).toMatchObject({ researchStatus: 'done', planBasis: 'Standard' })
    expect(store.tables.get('decisions')![0].data.status).toBe('reviewing')
  })

  it('can run twice without duplicating rows, and keeps user corrections', async () => {
    await researchCandidate({ decisionId: 'd1', candidateId: 'c1' }, deps())
    const kb = store.tables.get('claims')!.find((r) => r.data.criterionId === 'kb')!
    Object.assign(kb.data, { value: 'Yes, Docs on all plans', origin: 'user' })

    await researchCandidate({ decisionId: 'd1', candidateId: 'c1' }, deps())
    expect(store.tables.get('claims')).toHaveLength(3)
    expect(store.tables.get('sources')).toHaveLength(1)
    expect(claimsBy().kb).toMatchObject({ value: 'Yes, Docs on all plans', origin: 'user' })
  })

  it('finds the official domain itself when no website was given', async () => {
    store.tables.get('candidates')![0].data.homepageUrl = ''
    await researchCandidate({ decisionId: 'd1', candidateId: 'c1' }, deps())
    const scoped = calls.filter((x) => x.endpoint === 'exa/search' && x.params.includeDomains)
    expect(scoped).toHaveLength(2)
    expect(scoped[0].params.includeDomains).toEqual(['helpscout.com'])
  })

  it('skips the model call when no page has readable text', async () => {
    const d = deps()
    d.callIntegration = async (endpoint, params) => {
      calls.push({ endpoint, params })
      return { results: [{ url: 'https://www.helpscout.com/app', title: 'App' }] } // no text
    }
    await researchCandidate({ decisionId: 'd1', candidateId: 'c1' }, d)
    expect(calls.some((x) => x.endpoint === 'openai/chat-completion')).toBe(false)
    expect(Object.values(claimsBy()).every((c) => c.verification === 'not_found')).toBe(true)
  })

  it('throws on an unusable model reply so the job can retry', async () => {
    modelReply = 'I could not find anything.'
    await expect(researchCandidate({ decisionId: 'd1', candidateId: 'c1' }, deps())).rejects.toThrow(/no JSON/)
  })
})

describe('recordFailure', () => {
  it('shows a retry on early attempts and a failure on the last one', async () => {
    const p = { decisionId: 'd1', candidateId: 'c1' }
    await recordFailure(deps(), p, new Error('Exa timeout'), false)
    expect(store.tables.get('candidates')![0].data).toMatchObject({ researchStatus: 'queued', error: 'Exa timeout' })
    await recordFailure(deps(), p, new Error('Exa timeout'), true)
    expect(store.tables.get('candidates')![0].data).toMatchObject({ researchStatus: 'failed' })
    expect(store.tables.get('decisions')![0].data.status).toBe('reviewing')
  })
})
