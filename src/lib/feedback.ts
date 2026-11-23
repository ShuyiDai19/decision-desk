/** Validation and summary for teammates' feedback on a shared decision. */

import { STANCES, type Stance } from '../schemas/feedback-schema'

export const MAX_COMMENT = 500

export type FeedbackInput = { stance: Stance; comment: string }

export function validateFeedback(input: unknown): { ok: true; value: FeedbackInput } | { ok: false; error: string } {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const stance = raw.stance
  if (typeof stance !== 'string' || !(STANCES as readonly string[]).includes(stance)) {
    return { ok: false, error: 'Choose "I agree" or "I have concerns".' }
  }
  const comment = typeof raw.comment === 'string' ? raw.comment.trim() : ''
  if (comment.length > MAX_COMMENT) return { ok: false, error: `Keep the comment under ${MAX_COMMENT} characters.` }
  if (stance === 'concerns' && !comment) return { ok: false, error: 'Say briefly what concerns you, so the author can act on it.' }
  return { ok: true, value: { stance: stance as Stance, comment } }
}

/** Display name from a profile: the name, else the part of the email before @, else "A teammate". */
export function displayName(profile: { name?: string; email?: string } | undefined): string {
  const name = profile?.name?.trim()
  if (name) return name.slice(0, 120)
  const local = profile?.email?.split('@')[0]?.trim()
  return local ? local.slice(0, 120) : 'A teammate'
}

export function summarize(rows: { stance: string }[]): { agree: number; concerns: number } {
  return {
    agree: rows.filter((r) => r.stance === 'agree').length,
    concerns: rows.filter((r) => r.stance === 'concerns').length,
  }
}
