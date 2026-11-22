/**
 * /decisions/:id: one decision. Research controls with live progress, then
 * the comparison table once claims exist.
 *
 * Reads go through useQuery, so they are limited to the caller's own rows by
 * the collections' RBAC; another user's decision id simply shows "not found".
 */

import { Link, useParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui'
import { ComparisonTable } from '@/components/decision/ComparisonTable'
import { ResearchControls } from '@/components/decision/ResearchControls'
import { DECISION_STATUS_LABEL, formatDate } from '@/components/decision/labels'
import type { Decision } from '../../../../schemas/decisions-schema'
import type { Criterion } from '../../../../schemas/criteria-schema'
import type { Candidate } from '../../../../schemas/candidates-schema'
import type { Claim } from '../../../../schemas/claims-schema'
import type { Source } from '../../../../schemas/sources-schema'

export default function DecisionPage() {
  const { id = '' } = useParams()
  const decisions = useQuery<Decision>('decisions', { limit: 200 })
  const criteria = useQuery<Criterion>('criteria', { where: { decisionId: id }, orderBy: 'order', orderDir: 'asc' })
  const candidates = useQuery<Candidate>('candidates', { where: { decisionId: id }, orderBy: 'createdAt', orderDir: 'asc' })
  const claims = useQuery<Claim>('claims', { where: { decisionId: id }, limit: 100 })
  const sources = useQuery<Source>('sources', { where: { decisionId: id }, limit: 100 })

  const decision = decisions.records.find((r) => r.recordId === id)

  if (decisions.status === 'loading') {
    return <p className="px-6 py-12 text-center text-sm text-muted-foreground">Loading…</p>
  }
  if (!decision) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <BackLink />
        <h1 className="text-2xl font-semibold">Decision not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">It may have been deleted, or it belongs to another account.</p>
      </div>
    )
  }

  const status = DECISION_STATUS_LABEL[decision.data.status] ?? DECISION_STATUS_LABEL.draft

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <BackLink />
      <header className="mb-10 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Badge variant={status.variant}>{status.label}</Badge>
          <span className="text-xs text-muted-foreground">Created {formatDate(decision.createdAt)}</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{decision.data.question}</h1>
        {decision.data.context && <p className="text-muted-foreground">{decision.data.context}</p>}
      </header>

      <div className="flex flex-col gap-10">
        <ResearchControls decisionId={id} candidates={candidates.records} />

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Comparison</h2>
          {claims.records.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Run research to fill the table. Each cell will cite the page it came from.
            </p>
          ) : (
            <ComparisonTable
              criteria={criteria.records}
              candidates={candidates.records}
              claims={claims.records}
              sources={sources.records}
            />
          )}
        </section>
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/home" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> All decisions
    </Link>
  )
}
