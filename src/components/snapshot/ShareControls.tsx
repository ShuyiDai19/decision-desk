/**
 * Owner-only controls on a snapshot: turn the public link on/off, copy it,
 * and email the brief (self + up to 3 teammates, confirmed before sending).
 */

import { useState } from 'react'
import { Copy, Link2, Mail } from 'lucide-react'
import { useAuthProfileReady, type RecordData } from 'deepspace'
import { Button, Label, Switch, Textarea } from '@/components/ui'
import { callAction } from '@/lib/call-action'
import { MAX_RECIPIENTS, parseRecipients } from '@/lib/recipients'
import { formatDate } from '../decision/labels'
import type { Snapshot } from '../../schemas/snapshots-schema'

export function ShareControls({ snapshot }: { snapshot: RecordData<Snapshot> }) {
  const { user } = useAuthProfileReady({ requireUser: true })
  const isPublic = snapshot.data.visibility === 'public'
  const link = `${window.location.origin}/s/${snapshot.recordId}`

  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [recipients, setRecipients] = useState<string | null>(null)
  const [confirmList, setConfirmList] = useState<string[] | null>(null)

  const recipientText = recipients ?? user?.email ?? ''

  async function toggle(next: boolean) {
    setBusy(true)
    setMessage('')
    const res = await callAction('setSnapshotVisibility', { snapshotId: snapshot.recordId, visibility: next ? 'public' : 'private' })
    setBusy(false)
    if (!res.success) setMessage(res.error)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setMessage('Could not copy; select the link and copy it manually.')
    }
  }

  function review() {
    setMessage('')
    const parsed = parseRecipients(recipientText)
    if (!parsed.ok) setMessage(parsed.error)
    else setConfirmList(parsed.emails)
  }

  async function send() {
    if (!confirmList) return
    setBusy(true)
    setMessage('')
    const res = await callAction<{ sent: number }>('emailSnapshot', {
      snapshotId: snapshot.recordId,
      recipients: confirmList,
      origin: window.location.origin,
    })
    setBusy(false)
    setConfirmList(null)
    setMessage(res.success ? `Sent to ${res.data.sent} ${res.data.sent === 1 ? 'person' : 'people'}.` : res.error)
  }

  return (
    <aside className="flex flex-col gap-5 rounded-lg border border-border p-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="share-switch" className="flex items-center gap-2">
            <Link2 className="size-4" /> Anyone with the link can view
          </Label>
          <Switch id="share-switch" checked={isPublic} disabled={busy} onCheckedChange={(v: boolean) => toggle(v)} />
        </div>
        {isPublic ? (
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{link}</code>
            <Button size="sm" variant="outline" onClick={copy}>
              <Copy /> {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Only you can see this version.</p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Label htmlFor="recipients" className="flex items-center gap-2">
          <Mail className="size-4" /> Email the brief
        </Label>
        {snapshot.data.emailedAt ? (
          <p className="text-xs text-muted-foreground">
            Emailed {formatDate(snapshot.data.emailedAt)}. Finalize again to send an updated version.
          </p>
        ) : confirmList ? (
          <div className="flex flex-col gap-2 text-sm">
            <p>Send this brief to:</p>
            <ul className="ml-5 list-disc text-muted-foreground">
              {confirmList.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">The email links here, so sending turns on the share link.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={send} loading={busy} disabled={busy}>
                Send to {confirmList.length} {confirmList.length === 1 ? 'person' : 'people'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmList(null)} disabled={busy}>
                Edit
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Textarea
              id="recipients"
              rows={2}
              value={recipientText}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="you@team.com, teammate@team.com"
            />
            <p className="text-xs text-muted-foreground">You and up to {MAX_RECIPIENTS - 1} teammates, separated by commas.</p>
            <Button size="sm" variant="outline" className="self-start" onClick={review}>
              Review and send
            </Button>
          </>
        )}
      </div>

      {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
    </aside>
  )
}
