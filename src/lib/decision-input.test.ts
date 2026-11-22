import { describe, expect, it } from 'vitest'
import { validateNewDecision } from './decision-input'

const valid = {
  question: 'Which customer support tool should our 3-person team use?',
  context: 'Budget $100/month. Need a knowledge base and email support.',
  candidates: [
    { name: 'Help Scout', homepageUrl: 'https://www.helpscout.com' },
    { name: 'Zendesk', homepageUrl: '' },
  ],
  criteria: [
    { name: 'Price for 3 seats', description: '', weight: 5 },
    { name: 'Knowledge base', description: '', weight: 3 },
  ],
}

describe('validateNewDecision', () => {
  it('accepts a valid decision and trims whitespace', () => {
    const r = validateNewDecision({ ...valid, question: `  ${valid.question}  ` })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.question).toBe(valid.question)
  })

  it('rejects a 4th candidate (the server-side limit)', () => {
    const r = validateNewDecision({
      ...valid,
      candidates: [...valid.candidates, { name: 'Freshdesk', homepageUrl: '' }, { name: 'Intercom', homepageUrl: '' }],
    })
    expect(r).toEqual({ ok: false, errors: { candidates: 'Compare at most 3 options.' } })
  })

  it('rejects a 6th criterion', () => {
    const criteria = ['a', 'b', 'c', 'd', 'e', 'f'].map((name) => ({ name, description: '', weight: 3 }))
    const r = validateNewDecision({ ...valid, criteria })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.criteria).toBe('Use at most 5 criteria.')
  })

  it('requires at least two options and one criterion', () => {
    const r = validateNewDecision({ ...valid, candidates: [valid.candidates[0]], criteria: [] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['candidates', 'criteria'])
  })

  it('flags duplicate names regardless of case', () => {
    const r = validateNewDecision({
      ...valid,
      candidates: [
        { name: 'Zendesk', homepageUrl: '' },
        { name: 'zendesk', homepageUrl: '' },
      ],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors['candidates.1.name']).toBe('This option is listed twice.')
  })

  it('rejects non-http homepage URLs', () => {
    const r = validateNewDecision({
      ...valid,
      candidates: [
        { name: 'A', homepageUrl: 'javascript:alert(1)' },
        { name: 'B', homepageUrl: 'helpscout.com' },
      ],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors['candidates.0.homepageUrl']).toBeDefined()
      expect(r.errors['candidates.1.homepageUrl']).toBeDefined()
    }
  })

  it('rejects weights outside 1–5 and non-integers', () => {
    const r = validateNewDecision({
      ...valid,
      criteria: [
        { name: 'a', description: '', weight: 0 },
        { name: 'b', description: '', weight: 2.5 },
      ],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors)).toEqual(['criteria.0.weight', 'criteria.1.weight'])
  })

  it('survives garbage input without throwing', () => {
    for (const input of [null, undefined, 42, 'x', { candidates: 'nope', criteria: [null, 7] }]) {
      expect(validateNewDecision(input).ok).toBe(false)
    }
  })
})
