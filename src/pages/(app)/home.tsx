/**
 * Home: the signed-in user's decisions, newest first. Signed-out visitors
 * see what the app does and a sign-in button.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthOverlay, useAuthProfileReady, useQuery } from 'deepspace'
import { Scale } from 'lucide-react'
import { Badge, Button, EmptyState, buttonVariants } from '@/components/ui'
import { DECISION_STATUS_LABEL, formatDate } from '@/components/decision/labels'
import type { Decision } from '../../schemas/decisions-schema'

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAuthProfileReady({ requireUser: true })
  if (!isLoaded) return null
  return isSignedIn ? <DecisionList /> : <SignedOutIntro />
}

function SignedOutIntro() {
  const [showAuth, setShowAuth] = useState(false)
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-24">
      <h1 className="text-4xl font-bold tracking-tight">Decide with evidence, not vibes.</h1>
      <p className="text-lg text-muted-foreground">
        Describe a decision and the options you are weighing. Decision Desk reads each option&apos;s official
        pages, builds a comparison table where every cell cites its source, and lets you correct it before you
        choose.
      </p>
      <div>
        <Button size="lg" onClick={() => setShowAuth(true)}>
          Sign in to start
        </Button>
      </div>
      {showAuth && <AuthOverlay onClose={() => setShowAuth(false)} />}
    </div>
  )
}

function DecisionList() {
  const { records, status } = useQuery<Decision>('decisions', { orderBy: 'createdAt', orderDir: 'desc', limit: 50 })

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Your decisions</h1>
        <Link to="/decisions/new" className={buttonVariants()}>
          New decision
        </Link>
      </div>

      {status === 'loading' && <p className="text-sm text-muted-foreground">Loading…</p>}
      {status === 'error' && <p className="text-sm text-destructive">Could not load your decisions. Try reloading.</p>}

      {status === 'ready' && records.length === 0 && (
        <EmptyState
          icon={<Scale />}
          title="No decisions yet"
          description="Start with a question, two or three options, and what matters to you."
        />
      )}

      <ul className="flex flex-col gap-3">
        {records.map((r) => {
          const s = DECISION_STATUS_LABEL[r.data.status] ?? DECISION_STATUS_LABEL.draft
          return (
            <li key={r.recordId}>
              <Link
                to={`/decisions/${r.recordId}`}
                className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="font-medium">{r.data.question}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Created {formatDate(r.createdAt)}</p>
                </div>
                <Badge variant={s.variant}>{s.label}</Badge>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
