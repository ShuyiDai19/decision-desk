/**
 * The reviewers' sample.
 *
 *   appInfo         is there a sample? is the caller allowed to set it?
 *   markAsSample    owner only: make one of their decisions the sample
 *   copySample      anyone signed in: get their own copy (no research cost)
 *
 * "Owner" = the app owner (env.OWNER_USER_ID) or an admin. Under
 * `deepspace dev` (ALLOW_DEBUG_ROUTES=true, local only) anyone may mark the
 * sample so it can be tested without the owner account.
 */

import { resolveAppRole } from 'deepspace/worker'
import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { copySample as copySampleRows, findSample } from '../lib/sample-copy'
import type { Decision } from '../schemas/decisions-schema'
import type { Claim } from '../schemas/claims-schema'

const fail = (error: string, code: string) => ({ success: false as const, error, code })

async function canManageSample(env: Env, userId: string): Promise<boolean> {
  if (env.ALLOW_DEBUG_ROUTES === 'true') return true
  if (userId === env.OWNER_USER_ID) return true
  return (await resolveAppRole(env, userId)) === 'admin'
}

export const appInfo: ActionHandler<Env> = async ({ userId, tools, env }) => {
  const sample = await findSample(tools)
  return {
    success: true,
    data: { hasSample: !!sample, sampleQuestion: sample?.data.question ?? '', canManageSample: await canManageSample(env, userId) },
  }
}

export const markAsSample: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  if (!(await canManageSample(env, userId))) return fail('Only the app owner can set the sample.', 'forbidden')
  const decisionId = typeof params.decisionId === 'string' ? params.decisionId : ''
  const got = await tools.get<Decision>('decisions', decisionId)
  if (!got.success || got.data.record.data.ownerId !== userId) return fail('Decision not found.', 'not_found')
  const claims = await tools.query<Claim>('claims', { where: { decisionId }, limit: 1 })
  if (!claims.success || claims.data.records.length === 0) return fail('Research this decision before using it as the sample.', 'no_research')

  // Only one sample at a time.
  const current = await findSample(tools)
  if (current && current.recordId !== decisionId) await tools.update('decisions', current.recordId, { isSample: 0 })
  const r = await tools.update('decisions', decisionId, { isSample: 1 })
  return r.success ? { success: true, data: { decisionId } } : r
}

export const copySample: ActionHandler<Env> = async ({ userId, tools }) => {
  try {
    const copied = await copySampleRows(tools, userId)
    return copied ? { success: true, data: copied } : fail('No sample is available yet.', 'no_sample')
  } catch (err) {
    return fail(`Could not copy the sample: ${(err as Error).message}`, 'copy_failed')
  }
}
