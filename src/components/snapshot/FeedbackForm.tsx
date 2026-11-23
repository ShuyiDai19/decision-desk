/**
 * For teammates viewing a shared decision: "I agree" / "I have concerns" with
 * an optional comment (required for concerns). Signed-out viewers are asked
 * to sign in, so every response has a name. The responder can only read their
 * own response (feedback RBAC), which is how the form shows what they sent.
 */

import { useState } from 'react'
import { AlertCircle, ThumbsUp } from 'lucide-react'
import { AuthOverlay, useAuthStatus, useQuery } from 'deepspace'
import { Button, Textarea, cn } from '@/components/ui'
import { callAction } from '@/lib/call-action'
import { MAX_COMMENT, validateFeedback } from '@/lib/feedback'
import type { Feedback, Stance } from '../../schemas/feedback-schema'

export function FeedbackForm({ snapshotId, shareToken }: { snapshotId: string; shareToken: string }) {
  const { isSignedIn, userId } = useAuthStatus()
  const mine = useQuery<Feedback>('feedback', { where: { snapshotId }, limit: 5 }).records.find(
    (r) => r.data.authorId === userId,
  )
  const [stance, setStance] = useState<Stance | null>(null)
  const [comment, setComment] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showAuth, setShowAuth] = useState(false)

  if (!isSignedIn) {
    return (
      <section className="flex flex-col items-start gap-3 rounded-lg border border-border p-5">
        <h2 className="text-lg font-semibold">Do you agree with this decision?</h2>
        <p className="text-sm text-muted-foreground">Sign in to tell the author whether you agree or have concerns.</p>
        <Button variant="outline" onClick={() => setShowAuth(true)}>
          Sign in to respond
        </Button>
        {showAuth && <AuthOverlay onClose={() => setShowAuth(false)} />}
      </section>
    )
  }

  const currentStance = stance ?? (editing ? (mine?.data.stance ?? null) : null)
  const currentComment = comment ?? (editing ? (mine?.data.comment ?? '') : '')

  async function submit() {
    const parsed = validateFeedback({ stance: currentStance, comment: currentComment })
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setBusy(true)
    setError('')
    const res = await callAction('submitFeedback', { snapshotId, shareToken, ...parsed.value })
    setBusy(false)
    if (!res.success) {
      setError(res.error)
      return
    }
    setEditing(false)
    setStance(null)
    setComment(null)
  }

  if (mine && !editing) {
    return (
      <section className="flex flex-col items-start gap-2 rounded-lg border border-border p-5">
        <h2 className="text-lg font-semibold">Your response</h2>
        <p className="flex items-center gap-2 text-sm">
          {mine.data.stance === 'agree' ? <ThumbsUp className="size-4 text-success" /> : <AlertCircle className="size-4 text-warning" />}
          {mine.data.stance === 'agree' ? 'You agree with this decision.' : 'You have concerns.'}
        </p>
        {mine.data.comment && <p className="text-sm text-muted-foreground">“{mine.data.comment}”</p>}
        <p className="text-xs text-muted-foreground">Only the author can see responses.</p>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Change response
        </Button>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-5">
      <div>
        <h2 className="text-lg font-semibold">Do you agree with this decision?</h2>
        <p className="text-xs text-muted-foreground">Only the author sees your response.</p>
      </div>
      <div role="radiogroup" aria-label="Your response" className="flex flex-wrap gap-2">
        {(
          [
            ['agree', 'I agree', ThumbsUp],
            ['concerns', 'I have concerns', AlertCircle],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={currentStance === value}
            onClick={() => setStance(value)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
              currentStance === value ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent',
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      <Textarea
        aria-label="Comment"
        rows={2}
        maxLength={MAX_COMMENT}
        placeholder={currentStance === 'concerns' ? 'What concerns you? (required)' : 'Anything to add? (optional)'}
        value={currentComment}
        onChange={(e) => setComment(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={submit} loading={busy} disabled={busy || !currentStance}>
          Send to the author
        </Button>
        {editing && (
          <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
            Cancel
          </Button>
        )}
      </div>
    </section>
  )
}
