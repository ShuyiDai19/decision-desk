/** The frozen comparison table from a snapshot. Read-only; each cell has an anchor the brief links to. */

import { Badge } from '@/components/ui'
import type { SnapshotPayload } from '@/lib/brief'
import { hostnameOf } from '../../research/search'
import { formatDate } from '../decision/labels'

const STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'outline' | 'info' }> = {
  verified: { label: 'Quote verified', variant: 'success' },
  unverified: { label: 'Needs checking', variant: 'warning' },
  not_found: { label: 'Not found', variant: 'outline' },
  user_provided: { label: 'Team source', variant: 'info' },
}

export function SnapshotTable({ payload }: { payload: SnapshotPayload }) {
  const cell = (candidateId: string, criterionId: string) =>
    payload.claims.find((c) => c.candidateId === candidateId && c.criterionId === criterionId)

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="bg-muted/40">
            <th scope="col" className="w-44 p-3 text-left font-medium text-muted-foreground">
              Criterion
            </th>
            {payload.candidates.map((c) => (
              <th
                key={c.id}
                scope="col"
                className={c.id === payload.chosenCandidateId ? 'bg-primary/10 p-3 text-left font-semibold' : 'p-3 text-left font-semibold'}
              >
                <span className="flex items-center gap-2">
                  {c.name}
                  {c.id === payload.chosenCandidateId && <Badge size="sm">Chosen</Badge>}
                </span>
                {c.planBasis && <span className="block text-xs font-normal text-muted-foreground">Plan: {c.planBasis}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {payload.criteria.map((k) => (
            <tr key={k.id} className="border-t border-border align-top">
              <th scope="row" className="p-3 text-left font-medium">
                {k.name}
                <span className="block text-xs font-normal text-muted-foreground">Weight {k.weight}</span>
              </th>
              {payload.candidates.map((c) => {
                const x = cell(c.id, k.id)
                const status = x ? (x.origin === 'user' ? { label: 'Corrected by team', variant: 'outline' as const } : STATUS[x.verification]) : null
                return (
                  <td
                    key={c.id}
                    id={x ? `cell-${x.n}` : undefined}
                    className={c.id === payload.chosenCandidateId ? 'scroll-mt-24 bg-primary/5 p-3 target:ring-2 target:ring-primary' : 'scroll-mt-24 p-3 target:ring-2 target:ring-primary'}
                  >
                    {x ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">[{x.n}]</span>
                          {status && (
                            <Badge size="sm" variant={status.variant}>
                              {status.label}
                            </Badge>
                          )}
                          {x.flagged && (
                            <Badge size="sm" variant="warning">
                              Flagged
                            </Badge>
                          )}
                          {x.score > 0 && <span className="text-xs text-muted-foreground">{x.score}/5</span>}
                        </div>
                        <p className={x.value ? '' : 'text-muted-foreground'}>{x.value || 'Not found'}</p>
                        {x.quote && x.origin !== 'user' && (
                          <blockquote className="border-l-2 border-border pl-2 text-xs italic text-muted-foreground">
                            “{x.quote}”
                          </blockquote>
                        )}
                        {x.source && /^https?:\/\//.test(x.source.url) && (
                          <a
                            href={x.source.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-xs text-muted-foreground underline hover:text-foreground"
                          >
                            {hostnameOf(x.source.url)}
                            {x.source.fetchedAt ? ` · read ${formatDate(x.source.fetchedAt)}` : ''}
                          </a>
                        )}
                      </div>
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
            </th>
            {payload.candidates.map((c) => (
              <td key={c.id} className="p-3">
                <span className="text-lg font-semibold">{c.score ?? '—'}</span>
                <span className="block text-xs text-muted-foreground">
                  {c.covered} of {c.total} scored
                </span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
