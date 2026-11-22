import { describe, expect, it } from 'vitest'
import { quoteAppearsIn } from './verify'

const page = `Standard plan
  $25 per user/month, billed annually.
Includes a Docs knowledge base — publish help articles your customers can search.`

describe('quoteAppearsIn', () => {
  it('matches an exact quote', () => {
    expect(quoteAppearsIn('$25 per user/month, billed annually.', page)).toBe(true)
  })

  it('ignores case, line breaks and extra spaces', () => {
    expect(quoteAppearsIn('STANDARD PLAN $25 per user/month', page)).toBe(true)
  })

  it('treats curly quotes and dash variants as equal', () => {
    const curly = 'Includes a Docs knowledge base – publish help articles your customers can search.'
    expect(quoteAppearsIn(curly, page)).toBe(true)
  })

  it('tolerates a final period or a leading bullet the page does not have', () => {
    const bare = 'Pricing\n- Docs is included in all Help Scout plans\nFAQ'
    expect(quoteAppearsIn('Docs is included in all Help Scout plans.', bare)).toBe(true)
    expect(quoteAppearsIn('\u2022 Docs is included in all Help Scout plans', bare)).toBe(true)
  })

  it('still requires punctuation inside the quote to match', () => {
    expect(quoteAppearsIn('$25 per user/month billed annually.', page)).toBe(false)
  })

  it('rejects a paraphrase', () => {
    expect(quoteAppearsIn('Costs $25 for each user every month', page)).toBe(false)
  })

  it('rejects a changed number (the case that matters most)', () => {
    expect(quoteAppearsIn('$20 per user/month, billed annually.', page)).toBe(false)
  })

  it('rejects quotes too short to prove anything', () => {
    expect(quoteAppearsIn('Standard', page)).toBe(false)
  })

  it('rejects anything against an empty page', () => {
    expect(quoteAppearsIn('$25 per user/month, billed annually.', '')).toBe(false)
  })
})
