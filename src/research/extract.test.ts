import { describe, expect, it } from 'vitest'
import { buildMessages, parseExtraction } from './extract'

const ids = ['price', 'kb']

describe('parseExtraction', () => {
  it('parses a clean reply', () => {
    const reply = JSON.stringify({
      claims: [
        { criterionId: 'price', value: '$25/user/month', score: 4, rationale: 'Fits budget', sourceIndex: 0, quote: '$25 per user/month, billed annually.' },
        { criterionId: 'kb', value: 'Included', score: 5, rationale: 'Docs on all plans', sourceIndex: 1, quote: 'Docs knowledge base included' },
      ],
    })
    const out = parseExtraction(reply, ids, 2).claims
    expect(out.map((c) => [c.criterionId, c.score, c.sourceIndex])).toEqual([
      ['price', 4, 0],
      ['kb', 5, 1],
    ])
  })

  it('accepts JSON wrapped in a code fence', () => {
    const reply = '```json\n{"claims":[{"criterionId":"price","value":"$25","score":3,"rationale":"","sourceIndex":0,"quote":"price is 25 dollars per seat"}]}\n```'
    expect(parseExtraction(reply, ids, 1).claims[0].value).toBe('$25')
  })

  it('fills in criteria the model skipped as not found, in criteria order', () => {
    const reply = '{"claims":[{"criterionId":"kb","value":"Yes","score":5,"rationale":"","sourceIndex":0,"quote":"knowledge base on every plan"}]}'
    const out = parseExtraction(reply, ids, 1).claims
    expect(out.map((c) => [c.criterionId, c.value])).toEqual([
      ['price', null],
      ['kb', 'Yes'],
    ])
  })

  it('drops unknown criteria and nulls bad scores and page indexes', () => {
    const reply = JSON.stringify({
      claims: [
        { criterionId: 'invented', value: 'x', score: 5, rationale: '', sourceIndex: 0, quote: 'x' },
        { criterionId: 'price', value: '$25', score: 9, rationale: '', sourceIndex: 7, quote: 'some quote text here' },
      ],
    })
    const [price] = parseExtraction(reply, ids, 2).claims
    expect(price).toMatchObject({ score: null, sourceIndex: null, quote: null })
  })

  it('treats an empty value as not found', () => {
    const reply = '{"claims":[{"criterionId":"price","value":"  ","score":3,"rationale":"","sourceIndex":0,"quote":"abc"}]}'
    expect(parseExtraction(reply, ids, 1).claims[0]).toMatchObject({ value: null, score: null, quote: null })
  })

  it('returns the single plan the claims describe, or null when none is named', () => {
    const withPlan = '{"plan":" Suite Team ","claims":[]}'
    expect(parseExtraction(withPlan, ids, 1).plan).toBe('Suite Team')
    expect(parseExtraction('{"claims":[]}', ids, 1).plan).toBeNull()
  })

  it('throws on prose or the wrong shape, so the job retries', () => {
    expect(() => parseExtraction('Sorry, I cannot help.', ids, 1)).toThrow(/no JSON/)
    expect(() => parseExtraction('{"items":[]}', ids, 1)).toThrow(/wrong shape/)
  })
})

describe('buildMessages', () => {
  it('truncates page text and keeps page indexes', () => {
    const [, user] = buildMessages({
      productName: 'X',
      question: 'q',
      context: '',
      criteria: [{ id: 'price', name: 'Price', description: '' }],
      pages: [{ url: 'https://x.com', title: 'X', text: 'a'.repeat(20000) }],
    })
    const payload = JSON.parse(user.content)
    expect(payload.pages[0].index).toBe(0)
    expect(payload.pages[0].text.length).toBe(8000)
  })
})
