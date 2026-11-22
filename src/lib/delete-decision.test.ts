import { describe, expect, it } from 'vitest'
import { deleteDecisionCascade, type DeleteStore } from './delete-decision'

function fakeStore(rows: Record<string, { id: string; decisionId: string }[]>, failOn?: string) {
  const calls: string[] = []
  const store: DeleteStore = {
    async deleteWhere(c, where, limit = 100) {
      calls.push(c)
      if (c === failOn) return { success: false, error: 'boom' }
      const all = rows[c] ?? []
      const matching = all.filter((r) => r.decisionId === where.decisionId).slice(0, limit)
      rows[c] = all.filter((r) => !matching.includes(r))
      return { success: true, data: { deleted: matching.length } }
    },
    async remove(c, id) {
      calls.push(`${c}:${id}`)
      rows[c] = (rows[c] ?? []).filter((r) => r.id !== id)
      return { success: true, data: {} }
    },
  }
  return { store, rows, calls }
}

const many = (n: number, decisionId: string) => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, decisionId }))

describe('deleteDecisionCascade', () => {
  it("deletes only this decision's rows, and the decision last", async () => {
    const { store, rows, calls } = fakeStore({
      decisions: [{ id: 'd1', decisionId: 'd1' }, { id: 'd2', decisionId: 'd2' }],
      claims: [...many(3, 'd1'), ...many(2, 'd2')],
      snapshots: many(1, 'd1'),
    })
    const r = await deleteDecisionCascade(store, 'd1')
    expect(r.deleted).toBe(5) // 3 claims + 1 snapshot + the decision
    expect(rows.claims).toHaveLength(2)
    expect(rows.decisions.map((d) => d.id)).toEqual(['d2'])
    expect(calls.at(-1)).toBe('decisions:d1')
  })

  it('drains a collection larger than one batch', async () => {
    const { store, rows } = fakeStore({ decisions: [{ id: 'd1', decisionId: 'd1' }], claims: many(1200, 'd1') })
    await deleteDecisionCascade(store, 'd1')
    expect(rows.claims).toHaveLength(0)
  })

  it('keeps the decision when a child delete fails, so it can be retried', async () => {
    const { store, rows } = fakeStore({ decisions: [{ id: 'd1', decisionId: 'd1' }], criteria: many(2, 'd1') }, 'criteria')
    await expect(deleteDecisionCascade(store, 'd1')).rejects.toThrow(/criteria/)
    expect(rows.decisions).toHaveLength(1)
  })
})
