/**
 * Start-research button and per-option progress cards.
 *
 * Progress comes from each candidate record's researchStatus/progressNote,
 * which the background job updates; useQuery pushes those changes live.
 */

import { useState } from 'react'
import { ExternalLink, Loader2, RotateCcw, Search } from 'lucide-react'
import type { RecordData } from 'deepspace'
import { Button } from '@/components/ui'
import { callAction } from '@/lib/call-action'
import { RESEARCH_STATUS_LABEL } from './labels'
import type { Candidate } from '../../schemas/candidates-schema'

const IN_PROGRESS = new Set(['queued', 'searching', 'extracting'])

export function ResearchControls({ decisionId, candidates }: { decisionId: string; candidates: RecordData<Candidate>[] }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const running = candidates.some((c) => IN_PROGRESS.has(c.data.researchStatus))
  const researchedBefore = candidates.some((c) => c.data.researchStatus === 'done' || c.data.researchStatus === 'failed')

  async function start(candidateId?: string) {
    setBusy(true)
    setMessage('')
    const res = await callAction<{ queued: number }>('startResearch', { decisionId, ...(candidateId ? { candidateId } : {}) })
    setBusy(false)
    if (!res.success) setMessage(res.error)
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Research</h2>
          <p className="text-xs text-muted-foreground">
            Reads each option&apos;s official pages and quotes them. Re-running keeps cells you corrected.
          </p>
        </div>
        <Button onClick={() => start()} loading={busy} disabled={busy || running}>
          {running ? <Loader2 className="animate-spin" /> : <Search />}
          {running ? 'Researching…' : researchedBefore ? 'Research again' : 'Research these options'}
        </Button>
      </div>
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((c) => {
          const status = c.data.researchStatus
          return (
            <li key={c.recordId} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{c.data.name}</span>
                {c.data.homepageUrl && (
                  <a
                    href={c.data.homepageUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`${c.data.name} website`}
                  >
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
                {IN_PROGRESS.has(status) && <Loader2 className="size-3 animate-spin" />}
                {RESEARCH_STATUS_LABEL[status] ?? status}
                {c.data.progressNote && status !== 'idle' ? ` · ${c.data.progressNote}` : ''}
              </p>
              {status === 'failed' && (
                <div className="mt-2 flex flex-col gap-2">
                  {c.data.error && <p className="text-xs text-destructive">{c.data.error}</p>}
                  <Button variant="outline" size="sm" className="self-start" onClick={() => start(c.recordId)} disabled={busy}>
                    <RotateCcw /> Retry this option
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
