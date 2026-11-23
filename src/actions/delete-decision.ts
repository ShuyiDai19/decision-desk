/**
 * deleteDecision: permanently delete one of the caller's decisions, with its
 * criteria, options, sources, cells, snapshots and teammates' feedback
 * (shared links stop working).
 *
 * Refused while research is running (jobs would write into deleted rows) and
 * for the current reviewers' sample (the home-page example would break).
 * Actions run with RBAC off, so ownership is checked here.
 */

import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { deleteDecisionCascade } from '../lib/delete-decision'
import type { Decision } from '../schemas/decisions-schema'
import type { Candidate } from '../schemas/candidates-schema'

const fail = (error: string, code: string) => ({ success: false as const, error, code })
const IN_PROGRESS = new Set(['queued', 'searching', 'extracting'])

export const deleteDecision: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const decisionId = typeof params.decisionId === 'string' ? params.decisionId : ''
  const got = await tools.get<Decision>('decisions', decisionId)
  if (!decisionId || !got.success || got.data.record.data.ownerId !== userId) return fail('Decision not found.', 'not_found')
  if (got.data.record.data.isSample === 1) {
    return fail("This is the reviewers' sample. Mark another decision as the sample before deleting it.", 'is_sample')
  }

  const candidates = await tools.query<Candidate>('candidates', { where: { decisionId }, limit: 10 })
  if (candidates.success && candidates.data.records.some((c) => IN_PROGRESS.has(c.data.researchStatus))) {
    return fail('Wait for research to finish before deleting.', 'research_running')
  }

  try {
    return { success: true, data: await deleteDecisionCascade(tools, decisionId) }
  } catch (err) {
    return fail(`${(err as Error).message}. Try again; nothing else was changed.`, 'delete_failed')
  }
}
