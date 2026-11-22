import { describe, expect, it } from 'vitest'
import { copySample, type SampleStore } from './sample-copy'

type Row = { recordId: string; data: Record<string, unknown> }

function fakeStore(seed: Record<string, Row[]>) {
  const tables = new Map(Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r, data: { ...r.data } }))]))
  let n = 0
  const store: SampleStore = {
    async query(c, { where, limit }) {
      const all = (tables.get(c) ?? []).filter((r) => Object.entries(where).every(([k, v]) => r.data[k] === v))
      return { success: true, data: { records: all.slice(0, limit ?? 200) } }
    },
    async create(c, data) {
      const recordId = `${c}-new-${++n}`
      tables.set(c, [...(tables.get(c) ?? []), { recordId, data: { ...data } }])
      return { success: true, data: { recordId } }
    },
  }
  return { store, tables }
}

const seed = {
  decisions: [
    { recordId: 'd0', data: { ownerId: 'owner', question: 'Which tool?', context: '$100', status: 'decided', isSample: 1 } },
    { recordId: 'dx', data: { ownerId: 'owner', question: 'Other', context: '', status: 'draft', isSample: 0 } },
  ],
  criteria: [{ recordId: 'k1', data: { decisionId: 'd0', ownerId: 'owner', name: 'Price', description: '', weight: 5, order: 0 } }],
  candidates: [{ recordId: 'c1', data: { decisionId: 'd0', ownerId: 'owner', name: 'Help Scout', homepageUrl: '', planBasis: 'Standard', researchStatus: 'done' } }],
  sources: [{ recordId: 's1', data: { decisionId: 'd0', candidateId: 'c1', ownerId: 'owner', url: 'https://helpscout.com/pricing', fetchOk: 1 } }],
  claims: [
    {
      recordId: 'x1',
      data: { decisionId: 'd0', candidateId: 'c1', criterionId: 'k1', ownerId: 'owner', sourceId: 's1', value: '$90', score: 4, verification: 'verified', origin: 'ai', flagged: 0 },
    },
  ],
}

describe('copySample', () => {
  it('copies every row with remapped references, owned by the caller', async () => {
    const { store, tables } = fakeStore(seed)
    const result = await copySample(store, 'reviewer')
    expect(result).not.toBeNull()
    const id = result!.decisionId

    const decision = tables.get('decisions')!.find((r) => r.recordId === id)!
    expect(decision.data).toMatchObject({ question: 'Which tool?', status: 'reviewing', isSample: 0 })

    const [k] = tables.get('criteria')!.filter((r) => r.data.decisionId === id)
    const [c] = tables.get('candidates')!.filter((r) => r.data.decisionId === id)
    const [s] = tables.get('sources')!.filter((r) => r.data.decisionId === id)
    const [x] = tables.get('claims')!.filter((r) => r.data.decisionId === id)
    expect(s.data).toMatchObject({ candidateId: c.recordId, ownerId: 'reviewer', url: 'https://helpscout.com/pricing' })
    expect(x.data).toMatchObject({
      candidateId: c.recordId,
      criterionId: k.recordId,
      sourceId: s.recordId,
      ownerId: 'reviewer',
      value: '$90',
      verification: 'verified',
    })
  })

  it('leaves the sample itself untouched', async () => {
    const { store, tables } = fakeStore(seed)
    await copySample(store, 'reviewer')
    expect(tables.get('claims')!.find((r) => r.recordId === 'x1')!.data.ownerId).toBe('owner')
    expect(tables.get('decisions')!.find((r) => r.recordId === 'd0')!.data.isSample).toBe(1)
  })

  it('copies options oldest first, so the columns keep their order', async () => {
    const { store, tables } = fakeStore({
      ...seed,
      candidates: [
        { recordId: 'c3', createdAt: '2026-11-22T00:00:03Z', data: { decisionId: 'd0', name: 'Freshdesk' } },
        { recordId: 'c1', createdAt: '2026-11-22T00:00:01Z', data: { decisionId: 'd0', name: 'Help Scout' } },
        { recordId: 'c2', createdAt: '2026-11-22T00:00:02Z', data: { decisionId: 'd0', name: 'Zendesk' } },
      ] as never,
    })
    const { decisionId } = (await copySample(store, 'reviewer'))!
    const names = tables.get('candidates')!.filter((r) => r.data.decisionId === decisionId).map((r) => r.data.name)
    expect(names).toEqual(['Help Scout', 'Zendesk', 'Freshdesk'])
  })

  it('returns null when no sample has been marked', async () => {
    const { store } = fakeStore({ ...seed, decisions: [seed.decisions[1]] })
    expect(await copySample(store, 'reviewer')).toBeNull()
  })
})
