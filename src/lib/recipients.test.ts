import { describe, expect, it } from 'vitest'
import { parseRecipients } from './recipients'

describe('parseRecipients', () => {
  it('splits, trims, lowercases and de-duplicates', () => {
    expect(parseRecipients(' A@x.com, b@y.org\na@X.com ')).toEqual({ ok: true, emails: ['a@x.com', 'b@y.org'] })
  })
  it('rejects more than 4 people', () => {
    expect(parseRecipients('a@x.com b@x.com c@x.com d@x.com e@x.com').ok).toBe(false)
  })
  it('rejects malformed addresses and header-injection attempts', () => {
    expect(parseRecipients('not-an-email').ok).toBe(false)
    expect(parseRecipients(['a@x.com\r\nBcc: evil@x.com']).ok).toBe(false)
  })
  it('rejects empty input', () => {
    expect(parseRecipients('').ok).toBe(false)
    expect(parseRecipients(null).ok).toBe(false)
  })
})
