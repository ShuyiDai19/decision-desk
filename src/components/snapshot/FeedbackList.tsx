/** For the decision's author: teammates' responses to this version, live. */

import { AlertCircle, MessageSquare, ThumbsUp } from 'lucide-react'
import { useQuery } from 'deepspace'
import { summarize } from '@/lib/feedback'
import { formatDate } from '../decision/labels'
import type { Feedback } from '../../schemas/feedback-schema'

export function FeedbackList({ snapshotId, isPublic }: { snapshotId: string; isPublic: boolean }) {
  const { records } = useQuery<Feedback>('feedback', { where: { snapshotId }, orderBy: 'createdAt', orderDir: 'desc', limit: 50 })
  const counts = summarize(records.map((r) => r.data))

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <MessageSquare className="size-4" /> Team feedback
      </h2>
      {records.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {isPublic
            ? 'No responses yet. Teammates who open the link can say whether they agree.'
            : 'Turn on the share link (or email the brief) so teammates can respond.'}
        </p>
      ) : (
        <>
          <p className="text-sm">
            <span className="text-success">{counts.agree} agree</span>
            {' · '}
            <span className={counts.concerns ? 'text-warning' : ''}>
              {counts.concerns} {counts.concerns === 1 ? 'has' : 'have'} concerns
            </span>
          </p>
          <ul className="flex flex-col gap-3">
            {records.map((r) => (
              <li key={r.recordId} className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
                <span className="flex items-center gap-2">
                  {r.data.stance === 'agree' ? (
                    <ThumbsUp className="size-4 shrink-0 text-success" aria-label="Agrees" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0 text-warning" aria-label="Has concerns" />
                  )}
                  <span className="font-medium">{r.data.authorName || 'A teammate'}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(r.updatedAt)}</span>
                </span>
                {r.data.comment && <p className="text-muted-foreground">{r.data.comment}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
