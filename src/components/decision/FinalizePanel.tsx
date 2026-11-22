/**
 * "Decide" section on the decision page: choose an option, freeze a snapshot
 * with a brief, then go to its page to share or email it.
 *
 * Defaults to the current leader, but the user can choose anything: the
 * score informs the decision, it doesn't make it. If cells still need
 * checking or are flagged, finalizing asks for confirmation first.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, FileText } from 'lucide-react'
import type { RecordData } from 'deepspace'
import { Button, ConfirmModal, cn } from '@/components/ui'
import { callAction } from '@/lib/call-action'
import { rankCandidates, scoreCandidates } from '@/lib/score'
import { formatDate } from './labels'
import type { Criterion } from '../../schemas/criteria-schema'
import type { Candidate } from '../../schemas/candidates-schema'
import type { Claim } from '../../schemas/claims-schema'
import type { Snapshot } from '../../schemas/snapshots-schema'

type Props = {
  decisionId: string
  criteria: RecordData<Criterion>[]
  candidates: RecordData<Candidate>[]
  claims: RecordData<Claim>[]
  snapshots: RecordData<Snapshot>[]
}

export function FinalizePanel({ decisionId, criteria, candidates, claims, snapshots }: Props) {
  const navigate = useNavigate()
  const ranked = rankCandidates(
    scoreCandidates(
      candidates.map((c) => c.recordId),
      criteria.map((k) => ({ id: k.recordId, weight: k.data.weight })),
      claims.map((c) => ({ candidateId: c.data.candidateId, criterionId: c.data.criterionId, score: c.data.score })),
    ),
  )
  const [picked, setPicked] = useState<string>('')
  const chosen = picked || ranked[0]?.candidateId || ''
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const open = claims.filter((c) => c.data.flagged === 1 || (c.data.verification === 'unverified' && c.data.origin !== 'user')).length
  const researching = candidates.some((c) => ['queued', 'searching', 'extracting'].includes(c.data.researchStatus))
  const versions = [...snapshots].sort((a, b) => b.data.version - a.data.version)

  async function finalize() {
    setBusy(true)
    setError('')
    const res = await callAction<{ snapshotId: string }>('finalizeDecision', { decisionId, chosenCandidateId: chosen })
    setBusy(false)
    setConfirming(false)
    if (res.success) navigate(`/s/${res.data.snapshotId}`)
    else setError(res.error)
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border p-5">
      <div>
        <h2 className="text-lg font-semibold">Decide</h2>
        <p className="text-xs text-muted-foreground">
          Saves a frozen copy of this table with a short brief. Later edits won&apos;t change what you shared.
        </p>
      </div>

      <div role="radiogroup" aria-label="Chosen option" className="flex flex-wrap gap-2">
        {candidates.map((c) => {
          const rank = ranked.findIndex((r) => r.candidateId === c.recordId)
          const score = ranked[rank]?.score
          return (
            <button
              key={c.recordId}
              type="button"
              role="radio"
              aria-checked={chosen === c.recordId}
              onClick={() => setPicked(c.recordId)}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                chosen === c.recordId ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent',
              )}
            >
              {chosen === c.recordId && <CheckCircle2 className="size-4 text-primary" />}
              <span className="font-medium">{c.data.name}</span>
              <span className="text-xs text-muted-foreground">{score ?? '—'}</span>
            </button>
          )
        })}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => (open > 0 ? setConfirming(true) : finalize())}
          loading={busy}
          disabled={busy || researching || !chosen}
        >
          Finalize decision
        </Button>
        {researching && <span className="text-xs text-muted-foreground">Wait for research to finish.</span>}
        {!researching && open > 0 && (
          <span className="text-xs text-warning">
            {open} {open === 1 ? 'cell is' : 'cells are'} flagged or need checking.
          </span>
        )}
      </div>

      {versions.length > 0 && (
        <div className="border-t border-border pt-3">
          <h3 className="mb-2 text-sm font-medium">Saved versions</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {versions.map((s) => (
              <li key={s.recordId}>
                <Link to={`/s/${s.recordId}`} className="inline-flex items-center gap-1.5 hover:underline">
                  <FileText className="size-4 text-muted-foreground" />
                  Version {s.data.version} ·{' '}
                  {candidates.find((c) => c.recordId === s.data.chosenCandidateId)?.data.name ?? 'Unknown'} ·{' '}
                  {formatDate(s.createdAt)}
                  {s.data.visibility === 'public' && <span className="text-xs text-muted-foreground">· shared</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={finalize}
        loading={busy}
        variant="default"
        title="Finalize with open items?"
        description={`${open} ${open === 1 ? 'cell is' : 'cells are'} flagged or need checking. The brief will list ${open === 1 ? 'it' : 'them'} under "Still to verify". You can fix ${open === 1 ? 'it' : 'them'} first and finalize again later.`}
        confirmText="Finalize anyway"
        cancelText="Review first"
      />
    </section>
  )
}
