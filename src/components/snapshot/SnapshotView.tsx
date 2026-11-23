/**
 * The body of a finalized decision: header, cited brief and the frozen table.
 * Used by the owner's page (/s/:id) and the share-link page (/share/:token);
 * `aside` and `afterBrief` let each page add its own controls.
 */

import type { ReactNode } from 'react'
import { Badge } from '@/components/ui'
import { parseBrief, type SnapshotPayload } from '@/lib/brief'
import { BriefView } from './BriefView'
import { SnapshotTable } from './SnapshotTable'
import { formatDate } from '../decision/labels'

type Props = {
  payload: SnapshotPayload
  version: number
  briefMarkdown: string
  aside?: ReactNode
  afterBrief?: ReactNode
}

export function SnapshotView({ payload, version, briefMarkdown, aside, afterBrief }: Props) {
  const chosen = payload.candidates.find((c) => c.id === payload.chosenCandidateId)
  return (
    <>
      <header className="mb-8 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="success">Decided</Badge>
          <span>
            Version {version} · frozen {formatDate(payload.finalizedAt)}
          </span>
          {payload.briefSource === 'template' && <span>· brief generated from a template</span>}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{payload.question}</h1>
        {payload.context && <p className="text-muted-foreground">{payload.context}</p>}
        {chosen && (
          <p className="text-lg">
            Chosen: <strong>{chosen.name}</strong>
            {chosen.planBasis && <span className="text-muted-foreground"> · {chosen.planBasis} plan</span>}
          </p>
        )}
      </header>

      <div className={aside ? 'grid gap-8 lg:grid-cols-[1fr_320px]' : ''}>
        <section className="rounded-lg border border-border bg-card p-6">
          <BriefView blocks={parseBrief(briefMarkdown)} claims={payload.claims} />
          <p className="mt-6 text-xs text-muted-foreground">
            Numbers in brackets link to the cell below that supports the statement. Facts are as read on the dates shown.
          </p>
        </section>
        {aside && <div className="flex flex-col gap-6">{aside}</div>}
      </div>

      {afterBrief && <div className="mt-8">{afterBrief}</div>}

      <section className="mt-10 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">The comparison behind it</h2>
        <SnapshotTable payload={payload} />
      </section>
    </>
  )
}

export function Unavailable({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">This decision isn&apos;t available</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
