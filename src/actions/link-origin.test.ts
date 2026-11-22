import { describe, expect, it } from 'vitest'
import { linkOrigin } from './finalize'

describe('linkOrigin', () => {
  it('uses localhost when the email is sent from the local dev server', () => {
    expect(linkOrigin('http://localhost:5173', 'decision-desk')).toBe('http://localhost:5173')
  })
  it('uses the deployed app for the deployed origin and when nothing is sent', () => {
    expect(linkOrigin('https://decision-desk.app.space', 'decision-desk')).toBe('https://decision-desk.app.space')
    expect(linkOrigin(undefined, 'decision-desk')).toBe('https://decision-desk.app.space')
  })
  it('ignores any other site, so emails cannot be pointed elsewhere', () => {
    expect(linkOrigin('https://evil.example', 'decision-desk')).toBe('https://decision-desk.app.space')
    expect(linkOrigin('https://localhost.evil.example', 'decision-desk')).toBe('https://decision-desk.app.space')
    expect(linkOrigin('javascript:alert(1)', 'decision-desk')).toBe('https://decision-desk.app.space')
  })
})
