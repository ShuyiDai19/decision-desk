import { describe, expect, it } from 'vitest'
import {
  briefToHtml,
  briefToText,
  buildSnapshotPayload,
  openItems,
  parseBrief,
  readPayload,
  sanitizeBrief,
  templateBrief,
  type SnapshotInput,
} from './brief'

const input: SnapshotInput = {
  question: 'Which support tool?',
  context: '$100/month',
  chosenCandidateId: 'hs',
  finalizedAt: '2026-11-22T06:00:00Z',
  criteria: [
    { id: 'kb', name: 'Knowledge base', description: '', weight: 4, order: 1 },
    { id: 'price', name: 'Price', description: '', weight: 5, order: 0 },
  ],
  candidates: [
    { id: 'hs', name: 'Help Scout', homepageUrl: '', planBasis: 'Standard' },
    { id: 'zd', name: 'Zendesk', homepageUrl: '', planBasis: 'Suite Team' },
  ],
  claims: [
    { candidateId: 'hs', criterionId: 'price', value: '$90/month', score: 4, rationale: '', quote: '$30 per user/mo', verification: 'verified', origin: 'ai', flagged: 0, sourceId: 's1' },
    { candidateId: 'zd', criterionId: 'price', value: '$165/month', score: 2, rationale: '', quote: '', verification: 'verified', origin: 'user', flagged: 0, sourceId: 's2' },
    { candidateId: 'hs', criterionId: 'kb', value: '1 Docs site', score: 4, rationale: '', quote: 'x', verification: 'verified', origin: 'ai', flagged: 1, sourceId: '' },
    { candidateId: 'zd', criterionId: 'kb', value: 'Help center', score: 4, rationale: '', quote: 'y', verification: 'unverified', origin: 'ai', flagged: 0, sourceId: '' },
  ],
  sources: [
    { id: 's1', url: 'https://www.helpscout.com/pricing/', title: 'Pricing', fetchedAt: '2026-11-22' },
    { id: 's2', url: 'https://www.zendesk.com/pricing/', title: 'Pricing', fetchedAt: '2026-11-22' },
  ],
}

describe('buildSnapshotPayload', () => {
  it('numbers cells row by row in criteria order and attaches sources', () => {
    const p = buildSnapshotPayload(input)
    expect(p.claims.map((c) => `${c.n}:${c.criterionId}/${c.candidateId}`)).toEqual([
      '1:price/hs',
      '2:price/zd',
      '3:kb/hs',
      '4:kb/zd',
    ])
    expect(p.claims[0].source?.url).toBe('https://www.helpscout.com/pricing/')
    expect(p.claims[2].source).toBeNull()
  })

  it('freezes weighted scores with the shared scoring function', () => {
    const p = buildSnapshotPayload(input)
    // Help Scout: (5·4 + 4·4) / 9 = 4; Zendesk: (5·2 + 4·4) / 9 = 2.89
    expect(p.candidates.map((c) => c.score)).toEqual([4, 2.89])
  })
})

describe('openItems', () => {
  it('lists flagged cells and AI cells that need checking, not user corrections', () => {
    const p = buildSnapshotPayload(input)
    expect(openItems(p.claims).map((c) => c.n)).toEqual([3, 4])
  })
})

describe('sanitizeBrief', () => {
  it('drops citations to cells that do not exist, links and HTML', () => {
    const md = 'Costs $90 [1][9]. See [pricing](https://evil.example) <script>x</script>'
    expect(sanitizeBrief(md, 4)).toBe('Costs $90 [1]. See pricing x')
  })
})

describe('templateBrief', () => {
  it('produces all four sections and lists open items', () => {
    const p = buildSnapshotPayload(input)
    const md = templateBrief(p)
    expect(md).toContain('## Decision')
    expect(md).toContain('**Help Scout** (Standard plan)')
    expect(md).toContain('## Still to verify')
    expect(md).toContain('[3]')
    expect(md).toContain('[4]')
  })
})

describe('parseBrief + renderers', () => {
  const md = '## Decision\nWe chose **Help Scout** [1].\n- Cheapest [1][2]'
  const p = buildSnapshotPayload(input)

  it('parses headings, paragraphs, bullets, bold and citations', () => {
    const blocks = parseBrief(md)
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'bullet'])
    expect(blocks[1].inline).toEqual([
      { kind: 'text', text: 'We chose ' },
      { kind: 'bold', text: 'Help Scout' },
      { kind: 'text', text: ' ' },
      { kind: 'cite', n: 1 },
      { kind: 'text', text: '.' },
    ])
  })

  it('renders escaped HTML with citation links to sources', () => {
    const html = briefToHtml(parseBrief('Price <b>is</b> fine [1] & [3]'), p.claims)
    expect(html).toBe(
      '<p>Price &lt;b&gt;is&lt;/b&gt; fine <a href="https://www.helpscout.com/pricing/" style="color:#6366f1">[1]</a> &amp; [3]</p>',
    )
  })

  it('renders plain text', () => {
    expect(briefToText(parseBrief(md))).toBe('DECISION\nWe chose Help Scout [1].\n- Cheapest [1][2]')
  })
})

describe('readPayload', () => {
  it('accepts an object or its JSON string, and rejects anything else', () => {
    const p = { ...buildSnapshotPayload(input), briefSource: 'ai' as const }
    expect(readPayload(p)?.question).toBe('Which support tool?')
    expect(readPayload(JSON.stringify(p))?.question).toBe('Which support tool?')
    expect(readPayload('not json')).toBeNull()
    expect(readPayload({ format: 2 })).toBeNull()
  })
})
