/**
 * Background-job handler — invoked by AppJobRoom (worker.ts) for every job.
 * Dispatch on `job.type`; return a result or throw to fail.
 *
 * JobContext has no record API, so jobs reach records through the SDK's
 * buildCronContext, which acts as the app owner (RBAC off). Jobs must only
 * touch records named in their own payload, which a server action wrote.
 */

import { buildCronContext } from 'deepspace/worker'
import type { Job, JobContext } from 'deepspace/worker'
import type { Env } from '../worker'
import { recordFailure, researchCandidate, type ResearchDeps, type ResearchPayload } from './research/run-candidate'

export async function runJob(job: Job, ctx: JobContext, env: Env): Promise<unknown> {
  switch (job.type) {
    // One job per candidate, enqueued by the startResearch action after it
    // checked ownership and quota. See src/research/run-candidate.ts.
    case 'research.candidate': {
      const payload = job.payload as ResearchPayload
      const app = buildCronContext(env, env.OWNER_USER_ID, `app:${env.DEEPSPACE_APP_ID}`)
      const deps: ResearchDeps = {
        records: app.records,
        callIntegration: (endpoint, params) => app.integrations.call(endpoint, params),
        progress: (value, message) => ctx.progress(value, message),
        now: () => new Date(),
      }
      try {
        return await researchCandidate(payload, deps)
      } catch (err) {
        // attempts is incremented before each run; the platform retries only while attempts < maxAttempts.
        await recordFailure(deps, payload, err, job.attempts >= job.maxAttempts).catch(() => {})
        throw err
      }
    }
    default:
      throw new Error(`Unknown job type: ${job.type}`)
  }
}
