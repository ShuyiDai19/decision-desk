/**
 * submitFeedback: a signed-in teammate responds to a shared decision
 * ("I agree" / "I have concerns" + comment). Submitting again updates the
 * same response.
 *
 * Only someone holding the current share link can respond (the token is
 * checked, not just the snapshot id), and not the decision's author.
 * The responder's name comes from their profile on the server, so it can't
 * be faked from the browser. Actions run with RBAC off; checks are here.
 */

import { timingSafeEqualStrings } from 'deepspace/worker'
import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { displayName, validateFeedback } from '../lib/feedback'
import { isShareTokenShape } from '../lib/share'
import type { Feedback } from '../schemas/feedback-schema'
import type { Snapshot } from '../schemas/snapshots-schema'

const fail = (error: string, code: string) => ({ success: false as const, error, code })

export const submitFeedback: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const parsed = validateFeedback(params)
  if (!parsed.ok) return fail(parsed.error, 'invalid_input')

  const snapshotId = typeof params.snapshotId === 'string' ? params.snapshotId : ''
  const token = params.shareToken
  const unavailable = fail('This share link no longer works, so it can’t take feedback.', 'not_found')
  if (!snapshotId || !isShareTokenShape(token)) return unavailable
  const got = await tools.get<Snapshot>('snapshots', snapshotId)
  if (!got.success || got.data.record.data.visibility !== 'public') return unavailable
  if (!(await timingSafeEqualStrings(got.data.record.data.shareToken ?? '', token))) return unavailable
  const snap = got.data.record
  if (snap.data.ownerId === userId) return fail('This is your own decision.', 'own_decision')

  const me = await tools.get<{ name?: string; email?: string }>('users', userId)
  const authorName = displayName(me.success ? me.data.record.data : undefined)

  const existing = await tools.query<Feedback>('feedback', { where: { snapshotId, authorId: userId }, limit: 1 })
  const prior = existing.success ? existing.data.records[0] : undefined
  const r = prior
    ? await tools.update('feedback', prior.recordId, { stance: parsed.value.stance, comment: parsed.value.comment, authorName })
    : await tools.create('feedback', {
        snapshotId,
        decisionId: snap.data.decisionId,
        snapshotOwnerId: snap.data.ownerId,
        authorId: userId,
        authorIds: JSON.stringify([userId]),
        authorName,
        stance: parsed.value.stance,
        comment: parsed.value.comment,
      })
  return r.success ? { success: true, data: { updated: !!prior } } : r
}
