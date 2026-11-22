import { enqueueJob } from 'deepspace/worker'
import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { createDecision } from './create-decision'
import { startResearch } from './start-research'

/**
 * Server actions run with per-record RBAC OFF (see src/server/action-routes.ts).
 * Every action that touches existing records must check ownership itself.
 */
export const actions: Record<string, ActionHandler<Env>> = {
  createDecision,
  startResearch,

  /**
   * TEMPORARY platform probe: create a probe record owned by the caller, then
   * enqueue a job that updates it step by step from the worker side.
   */
  startProbe: async ({ userId, tools, env }) => {
    const created = await tools.create('probes', { status: 'queued', step: 0 })
    if (!created.success) return created
    const probeId = created.data.recordId
    const jobId = await enqueueJob(
      env.JOB_ROOMS,
      `app:${env.DEEPSPACE_APP_ID}`,
      'probe',
      { probeId },
      { maxAttempts: 1, enqueuedBy: userId },
    )
    return { success: true, data: { probeId, jobId } }
  },
}
