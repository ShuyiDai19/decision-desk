/**
 * /share/:token: a decision someone shared with you. Works signed out.
 *
 * Fetches exactly one snapshot from GET /api/shared/:token. Nothing else is
 * readable from here: the snapshots collection is owner-only, so the share
 * token in the link is the only way in. Signed-in visitors can respond.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { readPayload, type SnapshotPayload } from '@/lib/brief'
import type { SharedSnapshot } from '@/lib/share'
import { FeedbackForm } from '@/components/snapshot/FeedbackForm'
import { SnapshotView, Unavailable } from '@/components/snapshot/SnapshotView'

type State =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error' }
  | { kind: 'ready'; shared: SharedSnapshot; payload: SnapshotPayload }

export default function SharedSnapshotPage() {
  const { token = '' } = useParams()
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch(`/api/shared/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 404) return setState({ kind: 'missing' })
        if (!res.ok) return setState({ kind: 'error' })
        const shared = (await res.json()) as SharedSnapshot
        const payload = readPayload(shared.payload)
        setState(payload ? { kind: 'ready', shared, payload } : { kind: 'error' })
      })
      .catch(() => !cancelled && setState({ kind: 'error' }))
    return () => {
      cancelled = true
    }
  }, [token])

  if (state.kind === 'loading') return <p className="px-6 py-12 text-center text-sm text-muted-foreground">Loading…</p>
  if (state.kind === 'missing') {
    return <Unavailable message="This link has been turned off or replaced by its owner. Ask them for the current link." />
  }
  if (state.kind === 'error') return <Unavailable message="Something went wrong loading this decision. Try reloading the page." />

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <SnapshotView
        payload={state.payload}
        version={state.shared.version}
        briefMarkdown={state.shared.briefMarkdown}
        afterBrief={<FeedbackForm snapshotId={state.shared.snapshotId} shareToken={token} />}
      />
    </div>
  )
}
