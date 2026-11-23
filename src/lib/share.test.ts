import { describe, expect, it } from 'vitest'
import { generateShareToken, isShareTokenShape, loadSharedSnapshot, type ShareStore } from './share'

const TOKEN = 'a'.repeat(32)

function store(rows: { recordId: string; data: Record<string, unknown> }[], ignoreFilter = false): ShareStore {
  return {
    async query(_c, { where }) {
      return ignoreFilter ? rows : rows.filter((r) => Object.entries(where).every(([k, v]) => r.data[k] === v))
    },
  }
}

const shared = { recordId: 's1', data: { ownerId: 'owner', version: 2, briefMarkdown: '## Decision', payload: '{}', visibility: 'public', shareToken: TOKEN } }
const other = { recordId: 's2', data: { ownerId: 'someone', version: 1, briefMarkdown: 'secret', payload: '{}', visibility: 'public', shareToken: 'b'.repeat(32) } }

describe('generateShareToken', () => {
  it('makes 32-character, URL-safe, different tokens', () => {
    const a = generateShareToken()
    const b = generateShareToken()
    expect(isShareTokenShape(a)).toBe(true)
    expect(a).not.toBe(b)
  })
})

describe('loadSharedSnapshot', () => {
  it('returns only the snapshot with that token, without the owner id', async () => {
    const got = await loadSharedSnapshot(store([shared, other]), TOKEN)
    expect(got).toEqual({ snapshotId: 's1', version: 2, briefMarkdown: '## Decision', payload: '{}' })
    expect(JSON.stringify(got)).not.toContain('owner')
  })

  it('returns nothing once sharing is turned off', async () => {
    const off = { ...shared, data: { ...shared.data, visibility: 'private' } }
    expect(await loadSharedSnapshot(store([off]), TOKEN)).toBeNull()
  })

  it('rejects malformed or missing tokens before querying', async () => {
    for (const t of ['', 'short', `${TOKEN}x`, "' OR 1=1 --".padEnd(32, 'x'), undefined, 42]) {
      expect(await loadSharedSnapshot(store([shared]), t)).toBeNull()
    }
  })

  it('never returns a different snapshot even if the store ignored the filter', async () => {
    expect(await loadSharedSnapshot(store([other], true), TOKEN)).toBeNull()
  })
})
