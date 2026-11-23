/**
 * /s/:id: the owner's view of one finalized decision, with share controls and
 * teammates' feedback. Snapshots are readable by their owner only, so this
 * query returns just the caller's own snapshots; anyone else gets
 * "unavailable". Others read a shared snapshot at /share/:token.
 */

import { Link, useParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { ArrowLeft } from 'lucide-react'
import { readPayload } from '@/lib/brief'
import { ShareControls } from '@/components/snapshot/ShareControls'
import { FeedbackList } from '@/components/snapshot/FeedbackList'
import { SnapshotView, Unavailable } from '@/components/snapshot/SnapshotView'
import type { Snapshot } from '../../../schemas/snapshots-schema'

export default function SnapshotOwnerPage() {
  const { id = '' } = useParams()
  const snapshots = useQuery<Snapshot>('snapshots', { limit: 200 })
  const snapshot = snapshots.records.find((s) => s.recordId === id)
  const payload = snapshot ? readPayload(snapshot.data.payload) : null

  if (snapshots.status === 'loading') {
    return <p className="px-6 py-12 text-center text-sm text-muted-foreground">Loading…</p>
  }
  if (!snapshot || !payload) {
    return <Unavailable message="Only its author can open this page. If someone shared a decision with you, use the link they sent." />
  }

  const sharing = snapshot.data.visibility === 'public' && !!snapshot.data.shareToken

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link
        to={`/decisions/${snapshot.data.decisionId}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to the working decision
      </Link>
      <SnapshotView
        payload={payload}
        version={snapshot.data.version}
        briefMarkdown={snapshot.data.briefMarkdown}
        aside={
          <>
            <ShareControls snapshot={snapshot} />
            <FeedbackList snapshotId={snapshot.recordId} isPublic={sharing} />
          </>
        }
      />
    </div>
  )
}
