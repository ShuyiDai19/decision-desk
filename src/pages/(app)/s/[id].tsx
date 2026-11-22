/**
 * /s/:id: a finalized decision. Readable signed out when the owner has made
 * it public (snapshots RBAC: read 'published'); otherwise only the owner sees
 * it. Shows the brief, the frozen table it cites, and owner share controls.
 */

import { Link, useParams } from 'react-router-dom'
import { useAuthStatus, useQuery } from 'deepspace'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui'
import { parseBrief, readPayload } from '@/lib/brief'
import { BriefView } from '@/components/snapshot/BriefView'
import { SnapshotTable } from '@/components/snapshot/SnapshotTable'
import { ShareControls } from '@/components/snapshot/ShareControls'
import { formatDate } from '@/components/decision/labels'
import type { Snapshot } from '../../../schemas/snapshots-schema'

export default function SnapshotPage() {
  const { id = '' } = useParams()
  const { userId } = useAuthStatus()
  const snapshots = useQuery<Snapshot>('snapshots', { limit: 500 })
  const snapshot = snapshots.records.find((s) => s.recordId === id)
  const payload = snapshot ? readPayload(snapshot.data.payload) : null

  if (snapshots.status === 'loading') {
    return <p className="px-6 py-12 text-center text-sm text-muted-foreground">Loading…</p>
  }
  if (!snapshot || !payload) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">This decision isn&apos;t available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The link may have been turned off by its owner, or you may need to sign in with the account that made it.
        </p>
      </div>
    )
  }

  const isOwner = !!userId && snapshot.data.ownerId === userId
  const chosen = payload.candidates.find((c) => c.id === payload.chosenCandidateId)

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {isOwner && (
        <Link
          to={`/decisions/${snapshot.data.decisionId}`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to the working decision
        </Link>
      )}
      <header className="mb-8 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="success">Decided</Badge>
          <span>
            Version {snapshot.data.version} · frozen {formatDate(payload.finalizedAt)}
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

      <div className={isOwner ? 'grid gap-8 lg:grid-cols-[1fr_320px]' : ''}>
        <section className="rounded-lg border border-border bg-card p-6">
          <BriefView blocks={parseBrief(snapshot.data.briefMarkdown)} claims={payload.claims} />
          <p className="mt-6 text-xs text-muted-foreground">
            Numbers in brackets link to the cell below that supports the statement. Facts are as read on the dates shown.
          </p>
        </section>
        {isOwner && <ShareControls snapshot={snapshot} />}
      </div>

      <section className="mt-10 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">The comparison behind it</h2>
        <SnapshotTable payload={payload} />
      </section>
    </div>
  )
}
