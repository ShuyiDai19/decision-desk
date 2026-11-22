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

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new Error('canceled'))
    })
  })

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
    // TEMPORARY platform probe: three visible steps, 2 seconds apart.
    case 'probe': {
      const { probeId } = job.payload as { probeId: string }
      const app = buildCronContext(env, env.OWNER_USER_ID, `app:${env.DEEPSPACE_APP_ID}`)
      for (let step = 1; step <= 3; step++) {
        await app.records.update('probes', probeId, { status: `step ${step} of 3`, step })
        ctx.progress(step / 3, `step ${step} of 3`)
        if (step < 3) await sleep(2000, ctx.signal)
      }
      await app.records.update('probes', probeId, { status: 'done', step: 3 })
      return { probeId }
    }
    default:
      throw new Error(`Unknown job type: ${job.type}`)
  }
}
