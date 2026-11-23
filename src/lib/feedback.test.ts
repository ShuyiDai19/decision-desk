import { describe, expect, it } from 'vitest'
import { displayName, summarize, validateFeedback } from './feedback'

describe('validateFeedback', () => {
  it('accepts agreement with or without a comment, trimmed', () => {
    expect(validateFeedback({ stance: 'agree' })).toEqual({ ok: true, value: { stance: 'agree', comment: '' } })
    expect(validateFeedback({ stance: 'agree', comment: '  fine by me ' })).toEqual({
      ok: true,
      value: { stance: 'agree', comment: 'fine by me' },
    })
  })

  it('requires a comment when someone has concerns', () => {
    expect(validateFeedback({ stance: 'concerns', comment: '  ' }).ok).toBe(false)
    expect(validateFeedback({ stance: 'concerns', comment: 'Zendesk is over budget' }).ok).toBe(true)
  })

  it('rejects unknown stances, long comments and garbage', () => {
    expect(validateFeedback({ stance: 'veto' }).ok).toBe(false)
    expect(validateFeedback({ stance: 'agree', comment: 'x'.repeat(501) }).ok).toBe(false)
    expect(validateFeedback(null).ok).toBe(false)
  })
})

describe('displayName', () => {
  it('prefers the name, then the email local part, then a generic label', () => {
    expect(displayName({ name: 'Wendy Sheng', email: 'w@x.com' })).toBe('Wendy Sheng')
    expect(displayName({ name: ' ', email: 'shuyi.dai@x.com' })).toBe('shuyi.dai')
    expect(displayName(undefined)).toBe('A teammate')
  })
})

describe('summarize', () => {
  it('counts each stance', () => {
    expect(summarize([{ stance: 'agree' }, { stance: 'concerns' }, { stance: 'agree' }])).toEqual({ agree: 2, concerns: 1 })
  })
})
