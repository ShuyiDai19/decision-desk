import { describe, expect, it } from 'vitest'
import { FALLBACK_RESEARCH_ERROR, friendlyResearchError } from './errors'

describe('friendlyResearchError', () => {
  it.each([
    ['Integration call exa/search failed: HTTP 500', /Web search failed/],
    ['Integration call openai/chat-completion failed: upstream error', /AI service didn’t respond/],
    ['Integration call openai/chat-completion failed: Insufficient credits', /run out of research credits/],
    ['Integration call exa/search failed: 429 Too Many Requests', /busy right now/],
    ['Model reply was not valid JSON: Unexpected token', /couldn’t be read/],
    ['Model reply contained no JSON object', /couldn’t be read/],
    ['RecordRoom tool records.update failed: Unknown error', /couldn’t be saved/],
    ['Decision or candidate no longer exists', /removed from the decision/],
    ['The operation was aborted due to timeout', /took too long/],
    ['canceled', /cancelled/],
  ])('maps "%s"', (raw, expected) => {
    expect(friendlyResearchError(new Error(raw))).toMatch(expected)
  })

  it('prefers the specific cause over the service name', () => {
    // A credits problem reported by Exa should say "credits", not "web search failed".
    expect(friendlyResearchError('Integration call exa/search failed: payment required')).toMatch(/credits/)
  })

  it('falls back to a generic sentence and never shows the raw text', () => {
    const out = friendlyResearchError(new Error('TypeError: x is undefined at run-candidate.ts:42'))
    expect(out).toBe(FALLBACK_RESEARCH_ERROR)
    expect(friendlyResearchError(undefined)).toBe(FALLBACK_RESEARCH_ERROR)
  })
})
