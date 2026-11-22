/**
 * createDecision: validates the form input and writes the decision, its
 * criteria and its candidates in one go.
 *
 * Runs with record RBAC off (see src/server/action-routes.ts), which is why
 * every limit is checked here rather than trusted from the form. ownerId on
 * all three collections is stamped from the verified caller (userBound).
 *
 * The record room has no multi-row transaction, so if a later write fails the
 * action removes what it already wrote rather than leaving a half-built
 * decision behind.
 */

import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { validateNewDecision } from '../lib/decision-input'

export const createDecision: ActionHandler<Env> = async ({ params, tools }) => {
  const parsed = validateNewDecision(params)
  if (!parsed.ok) {
    return {
      success: false,
      error: 'Please fix the highlighted fields.',
      code: 'invalid_input',
      details: { fieldErrors: parsed.errors },
    }
  }
  const { question, context, candidates, criteria } = parsed.value

  const decision = await tools.create('decisions', { question, context, status: 'draft', chosenCandidateId: '', isSample: 0 })
  if (!decision.success) return decision
  const decisionId = decision.data.recordId

  const rollback = async () => {
    await tools.deleteWhere('criteria', { decisionId })
    await tools.deleteWhere('candidates', { decisionId })
    await tools.remove('decisions', decisionId)
  }

  for (const [order, c] of criteria.entries()) {
    const r = await tools.create('criteria', { decisionId, name: c.name, description: c.description, weight: c.weight, order })
    if (!r.success) {
      await rollback()
      return r
    }
  }
  for (const c of candidates) {
    const r = await tools.create('candidates', { decisionId, name: c.name, homepageUrl: c.homepageUrl, researchStatus: 'idle' })
    if (!r.success) {
      await rollback()
      return r
    }
  }

  return { success: true, data: { decisionId } }
}
