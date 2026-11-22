/**
 * TEMPORARY platform probe page at /probe. Delete with the probe schema, action
 * and job once the real research flow exists.
 *
 * What to look for: after clicking the button, the record's status should
 * change to "step 1 of 3", "step 2 of 3", "step 3 of 3", "done" by itself,
 * without reloading. That proves a job's writes reach the page in real time.
 */

import { useState } from 'react'
import { getAuthToken, useJobs, useQuery } from 'deepspace'
import { Button } from '@/components/ui'
import { SCOPE_ID } from '../../../constants'

type Probe = { ownerId: string; status: string; step: number }

export default function ProbePage() {
  const { records, status } = useQuery<Probe>('probes', { limit: 5 })
  const { jobs, connected } = useJobs(SCOPE_ID)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function start() {
    setBusy(true)
    setMessage('')
    try {
      const token = await getAuthToken()
      const res = await fetch('/api/actions/startProbe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({}),
      })
      const body = await res.json()
      setMessage(JSON.stringify(body))
    } catch (err) {
      setMessage(String(err))
    } finally {
      setBusy(false)
    }
  }

  const probeJobs = jobs.filter((j) => j.type === 'probe').slice(0, 5)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6 text-sm">
      <h1 className="text-xl font-semibold">Platform probe</h1>
      <Button onClick={start} disabled={busy}>
        {busy ? 'Starting…' : 'Start probe job'}
      </Button>
      {message && <pre className="whitespace-pre-wrap rounded border p-3">{message}</pre>}

      <section>
        <h2 className="font-medium">Probe records ({status})</h2>
        <p className="text-muted-foreground">Written by the job. Should update without a reload.</p>
        <ul className="mt-2 space-y-1">
          {records.map((r) => (
            <li key={r.recordId} className="rounded border p-2 font-mono">
              {r.recordId.slice(0, 8)} · {r.data.status}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-medium">Jobs (socket {connected ? 'connected' : 'not connected'})</h2>
        <p className="text-muted-foreground">
          May stay empty for new users: the job room only lets members and admins watch.
        </p>
        <ul className="mt-2 space-y-1">
          {probeJobs.map((j) => (
            <li key={j.id} className="rounded border p-2 font-mono">
              {j.status} · {Math.round((j.progress ?? 0) * 100)}% {j.progressMessage ?? ''} {j.error ?? ''}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
