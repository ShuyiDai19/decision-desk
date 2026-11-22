/**
 * startResearch: check the caller owns the decision, enforce the daily quota,
 * and enqueue one `research.candidate` job per option.
 *
 * Params:
 *   decisionId              research every option (counts against the quota)
 *   candidateId (optional)  retry one option whose research failed (free)
 *
 * Exa and OpenAI are billed to the app owner and the platform does not
 * rate-limit them, so the quota here is the only spending guard.
 */

import { enqueueJob } from 'deepspace/worker'
import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { Decision } from '../schemas/decisions-schema'
import type { Candidate } from '../schemas/candidates-schema'
import { MAX_RESEARCH_RUNS_PER_DAY, type Usage } from '../schemas/usage-schema'

/** The app owner tests the app a lot; give them more room. */
const OWNER_RESEARCH_RUNS_PER_DAY = 20
/**
 * Under `deepspace dev` (local only: .dev.vars sets ALLOW_DEBUG_ROUTES=true,
 * production never does), anyone signed in gets this many runs, so testing
 * with a second account isn't blocked. Calls are still real and still billed.
 */
const LOCAL_DEV_RESEARCH_RUNS_PER_DAY = 50
/** A candidate stuck "in progress" longer than this (e.g. after a crash) no longer blocks a new run. */
const STALE_AFTER_MS = 20 * 60 * 1000
const IN_PROGRESS = new Set(['queued', 'searching', 'extracting'])

const fail = (error: string, code: string) => ({ success: false as const, error, code })

/** Charges one research run for today; returns false when the quota is used up. */
async function takeQuota(tools: ActionTools, userId: string, limit: number): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10)
  const found = await tools.query<Usage>('usage', { where: { userId, day }, limit: 1 })
  if (!found.success) return false
  const row = found.data.records[0]
  if (row) {
    if (row.data.researchRuns >= limit) return false
    const r = await tools.update('usage', row.recordId, { researchRuns: row.data.researchRuns + 1 })
    return r.success
  }
  const r = await tools.create('usage', { day, researchRuns: 1 }) // userId is stamped (userBound)
  return r.success
}

export const startResearch: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const decisionId = typeof params.decisionId === 'string' ? params.decisionId : ''
  const retryCandidateId = typeof params.candidateId === 'string' ? params.candidateId : ''
  if (!decisionId) return fail('Missing decision.', 'invalid_input')

  // Ownership: actions run with RBAC off, so this check is the only one.
  const got = await tools.get<Decision>('decisions', decisionId)
  if (!got.success || got.data.record.data.ownerId !== userId) {
    return fail('Decision not found.', 'not_found')
  }

  const listed = await tools.query<Candidate>('candidates', { where: { decisionId }, limit: 10 })
  if (!listed.success) return listed
  const candidates = listed.data.records
  if (candidates.length === 0) return fail('This decision has no options to research.', 'invalid_input')

  const now = Date.now()
  const running = candidates.filter(
    (c) => IN_PROGRESS.has(c.data.researchStatus) && now - new Date(c.updatedAt).getTime() < STALE_AFTER_MS,
  )

  let targets = candidates
  if (retryCandidateId) {
    const one = candidates.find((c) => c.recordId === retryCandidateId)
    if (!one) return fail('Option not found.', 'not_found')
    if (one.data.researchStatus !== 'failed') return fail('Only failed options can be retried.', 'invalid_state')
    targets = [one]
  } else {
    if (running.length > 0) return fail('Research is already running for this decision.', 'already_running')
    const limit =
      env.ALLOW_DEBUG_ROUTES === 'true'
        ? LOCAL_DEV_RESEARCH_RUNS_PER_DAY
        : userId === env.OWNER_USER_ID
          ? OWNER_RESEARCH_RUNS_PER_DAY
          : MAX_RESEARCH_RUNS_PER_DAY
    if (!(await takeQuota(tools, userId, limit))) {
      return fail(`You have used today's ${limit} research runs. Try again tomorrow (UTC).`, 'quota_exceeded')
    }
  }

  const room = `app:${env.DEEPSPACE_APP_ID}`
  for (const c of targets) {
    await tools.update('candidates', c.recordId, { researchStatus: 'queued', progressNote: 'Waiting to start', error: '' })
    const jobId = await enqueueJob(env.JOB_ROOMS, room, 'research.candidate', { decisionId, candidateId: c.recordId }, {
      maxAttempts: 2,
      enqueuedBy: userId,
    })
    await tools.update('candidates', c.recordId, { jobId })
  }
  await tools.update('decisions', decisionId, { status: 'researching' })

  return { success: true, data: { queued: targets.length } }
}
