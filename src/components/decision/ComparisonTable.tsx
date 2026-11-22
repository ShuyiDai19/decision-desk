/**
 * The comparison table: one row per criterion, one column per option.
 *
 * Review interactions:
 *   - Each cell can be corrected or flagged (ClaimCell).
 *   - Each criterion's weight (1–5) can be changed; scores and the leader
 *     update instantly from local state, and the new weight is saved in the
 *     background. Scoring is the shared code in src/lib/score.ts, the same
 *     function the server uses when it freezes a snapshot.
 *   - A summary above the table counts what still needs attention.
 */

import { useState } from 'react'
import { useMutations, type RecordData } from 'deepspace'
import { AlertTriangle, Flag, Pencil } from 'lucide-react'
import { Badge, cn } from '@/components/ui'
import { rankCandidates, scoreCandidates } from '@/lib/score'
import { ClaimCell } from './ClaimCell'
import type { Criterion } from '../../schemas/criteria-schema'
import { MAX_WEIGHT, MIN_WEIGHT } from '../../schemas/criteria-schema'
import type { Candidate } from '../../schemas/candidates-schema'
import type { Claim } from '../../schemas/claims-schema'
import type { Source } from '../../schemas/sources-schema'

type Props = {
  criteria: RecordData<Criterion>[]
  candidates: RecordData<Candidate>[]
  claims: RecordData<Claim>[]
  sources: RecordData<Source>[]
}

const WEIGHTS = Array.from({ length: MAX_WEIGHT - MIN_WEIGHT + 1 }, (_, i) => MIN_WEIGHT + i)

export function ComparisonTable({ criteria, candidates, claims, sources }: Props) {
  const { putConfirmed: putCriterion } = useMutations<Criterion>('criteria')
  // Weight the user just picked, shown immediately while the save is in flight.
  const [pendingWeights, setPendingWeights] = useState<Record<string, number>>({})
  const [weightError, setWeightError] = useState('')

  const weightOf = (k: RecordData<Criterion>) => pendingWeights[k.recordId] ?? k.data.weight

  async function setWeight(criterionId: string, weight: number) {
    setWeightError('')
    setPendingWeights((w) => ({ ...w, [criterionId]: weight }))
    try {
      await putCriterion(criterionId, { weight })
    } catch {
      setWeightError('A weight could not be saved; the table shows the last saved weights.')
    } finally {
      setPendingWeights((w) => {
        const next = { ...w }
        if (next[criterionId] === weight) delete next[criterionId]
        return next
      })
    }
  }

  const claimFor = (candidateId: string, criterionId: string) =>
    claims.find((c) => c.data.candidateId === candidateId && c.data.criterionId === criterionId)
  const sourceById = new Map(sources.map((s) => [s.recordId, s]))

  const scores = scoreCandidates(
    candidates.map((c) => c.recordId),
    criteria.map((k) => ({ id: k.recordId, weight: weightOf(k) })),
    claims.map((c) => ({ candidateId: c.data.candidateId, criterionId: c.data.criterionId, score: c.data.score })),
  )
  const scoreOf = new Map(scores.map((s) => [s.candidateId, s]))
  const ranked = rankCandidates(scores)
  const leaderId = ranked[0]?.score !== null && ranked[0]?.score !== ranked[1]?.score ? ranked[0]?.candidateId : undefined

  return (
    <div className="flex flex-col gap-3">
      <ReviewSummary claims={claims} />
      {weightError && <p className="text-sm text-destructive">{weightError}</p>}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/40">
              <th scope="col" className="w-52 p-3 text-left font-medium text-muted-foreground">
                Criterion
              </th>
              {candidates.map((c) => (
                <th key={c.recordId} scope="col" className="p-3 text-left align-top font-semibold">
                  <span className="flex items-center gap-2">
                    {c.data.name}
                    {leaderId === c.recordId && (
                      <Badge size="sm" title="Highest weighted score with the current weights">
                        Leading
                      </Badge>
                    )}
                  </span>
                  {c.data.planBasis && (
                    <span
                      className="block text-xs font-normal text-muted-foreground"
                      title="Every row in this column is meant to describe this one plan."
                    >
                      Plan: {c.data.planBasis}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {criteria.map((k) => (
              <tr key={k.recordId} className="border-t border-border align-top">
                <th scope="row" className="p-3 text-left font-medium">
                  {k.data.name}
                  {k.data.description && (
                    <span className="block text-xs font-normal text-muted-foreground">{k.data.description}</span>
                  )}
                  <WeightPicker
                    label={`Weight for ${k.data.name}`}
                    value={weightOf(k)}
                    onChange={(w) => setWeight(k.recordId, w)}
                  />
                </th>
                {candidates.map((c) => {
                  const claim = claimFor(c.recordId, k.recordId)
                  return (
                    <td key={c.recordId} className="p-3">
                      {claim ? (
                        <ClaimCell claim={claim} source={sourceById.get(claim.data.sourceId)?.data} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr className="border-t-2 border-border bg-muted/40">
              <th scope="row" className="p-3 text-left font-semibold">
                Weighted score
                <span className="block text-xs font-normal text-muted-foreground">Out of 5, over scored criteria</span>
              </th>
              {candidates.map((c) => {
                const s = scoreOf.get(c.recordId)
                return (
                  <td key={c.recordId} className="p-3">
                    <span className={leaderId === c.recordId ? 'text-lg font-bold text-primary' : 'text-lg font-semibold'}>
                      {s?.score ?? '—'}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {s ? `${s.covered} of ${s.total} criteria scored` : ''}
                    </span>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function WeightPicker({ label, value, onChange }: { label: string; value: number; onChange: (w: number) => void }) {
  return (
    <span role="radiogroup" aria-label={label} className="mt-2 flex items-center gap-0.5">
      <span className="mr-1 text-xs font-normal text-muted-foreground">Weight</span>
      {WEIGHTS.map((w) => (
        <button
          key={w}
          type="button"
          role="radio"
          aria-checked={value === w}
          onClick={() => value !== w && onChange(w)}
          className={cn(
            'size-6 rounded text-xs font-medium transition-colors',
            value === w ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
          )}
        >
          {w}
        </button>
      ))}
    </span>
  )
}

function ReviewSummary({ claims }: { claims: RecordData<Claim>[] }) {
  const needsChecking = claims.filter((c) => c.data.verification === 'unverified' && c.data.origin !== 'user').length
  const flagged = claims.filter((c) => c.data.flagged === 1).length
  const corrected = claims.filter((c) => c.data.origin === 'user').length

  if (needsChecking + flagged + corrected === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Hover a cell to correct it <Pencil className="inline size-3" /> or flag it <Flag className="inline size-3" />.
        Change weights to see how the ranking moves.
      </p>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {needsChecking > 0 && (
        <span className="flex items-center gap-1.5 text-warning">
          <AlertTriangle className="size-4" />
          {needsChecking} {needsChecking === 1 ? 'cell needs' : 'cells need'} checking
        </span>
      )}
      {flagged > 0 && (
        <span className="flex items-center gap-1.5 text-warning">
          <Flag className="size-4" /> {flagged} flagged by you
        </span>
      )}
      {corrected > 0 && (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Pencil className="size-4" /> {corrected} corrected by you
        </span>
      )}
    </div>
  )
}
