/**
 * /decisions/:id: one decision. Shows the question, criteria (with weights)
 * and options with their research status. The comparison table and the
 * research controls build on this page.
 *
 * Reads go through useQuery, so they are limited to the caller's own rows by
 * the collections' RBAC; another user's decision id simply shows "not found".
 */

import { Link, useParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui'
import { DECISION_STATUS_LABEL, RESEARCH_STATUS_LABEL, formatDate } from '@/components/decision/labels'
import type { Decision } from '../../../../schemas/decisions-schema'
import type { Criterion } from '../../../../schemas/criteria-schema'
import type { Candidate } from '../../../../schemas/candidates-schema'

export default function DecisionPage() {
  const { id = '' } = useParams()
  const decisions = useQuery<Decision>('decisions', { limit: 200 })
  const criteria = useQuery<Criterion>('criteria', { where: { decisionId: id }, orderBy: 'order', orderDir: 'asc' })
  const candidates = useQuery<Candidate>('candidates', { where: { decisionId: id }, orderBy: 'createdAt', orderDir: 'asc' })

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
    <div className="mx-auto max-w-4xl px-6 py-12">
      <BackLink />
      <header className="mb-10 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Badge variant={status.variant}>{status.label}</Badge>
          <span className="text-xs text-muted-foreground">Created {formatDate(decision.createdAt)}</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{decision.data.question}</h1>
        {decision.data.context && <p className="text-muted-foreground">{decision.data.context}</p>}
      </header>

      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Options</h2>
          <ul className="flex flex-col gap-2">
            {candidates.records.map((c) => (
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
                <p className="mt-1 text-xs text-muted-foreground">
                  {RESEARCH_STATUS_LABEL[c.data.researchStatus] ?? c.data.researchStatus}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">What matters</h2>
          <ul className="flex flex-col gap-2">
            {criteria.records.map((c) => (
              <li key={c.recordId} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.data.name}</span>
                  <span className="text-xs text-muted-foreground">Weight {c.data.weight}</span>
                </div>
                {c.data.description && <p className="mt-1 text-xs text-muted-foreground">{c.data.description}</p>}
              </li>
            ))}
          </ul>
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
