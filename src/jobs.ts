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
