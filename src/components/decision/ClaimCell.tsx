/**
 * One cell of the comparison table, with review actions:
 *   - Edit: correct the value and score. Marks the cell origin = 'user', so
 *     re-running research keeps it.
 *   - Flag: mark the cell for checking (shown in the review summary).
 *
 * Writes go straight to the record room with useMutations. The claims
 * collection only lets the owner change value/score/rationale/origin/flagged,
 * so the quote, source and verification badge cannot be edited from here.
 */

import { useState } from 'react'
import { Flag, Pencil } from 'lucide-react'
import { useMutations, type RecordData } from 'deepspace'
import { Badge, Button, Textarea, cn, type BadgeProps } from '@/components/ui'
import { hostnameOf } from '../../research/search'
import { formatDate } from './labels'
import type { Claim, Verification } from '../../schemas/claims-schema'
import type { Source } from '../../schemas/sources-schema'

const BADGE: Record<Verification, { label: string; variant: NonNullable<BadgeProps['variant']>; title: string }> = {
  verified: {
    label: 'Quote verified',
    variant: 'success',
    title:
      'The quote was found word for word on the source page. The summary and score are the AI’s reading of it; check the evidence for numbers it calculated.',
  },
  unverified: {
    label: 'Needs checking',
    variant: 'warning',
    title: 'The AI’s quote could not be found on the source page. Check the page before relying on this.',
  },
  not_found: { label: 'Not found', variant: 'outline', title: 'The pages that were read did not answer this.' },
  user_provided: { label: 'Your source', variant: 'info', title: 'You supplied the source for this.' },
}

const SCORES = [1, 2, 3, 4, 5]

export function ClaimCell({ claim, source }: { claim: RecordData<Claim>; source?: Source }) {
  const { putConfirmed } = useMutations<Claim>('claims')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [draftValue, setDraftValue] = useState('')
  const [draftScore, setDraftScore] = useState(0)
  const [draftNote, setDraftNote] = useState('')

  const c = claim.data
  const badge = BADGE[c.verification] ?? BADGE.unverified
  const flagged = c.flagged === 1
  const corrected = c.origin === 'user'

  function startEdit() {
    setDraftValue(c.value)
    setDraftScore(c.score)
    setDraftNote(c.origin === 'user' ? c.rationale : '')
    setError('')
    setEditing(true)
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      await putConfirmed(claim.recordId, {
        value: draftValue.trim().slice(0, 500),
        score: draftScore,
        rationale: (draftNote.trim() || c.rationale).slice(0, 1000),
        origin: 'user',
      })
      setEditing(false)
    } catch {
      setError('Could not save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleFlag() {
    setError('')
    try {
      await putConfirmed(claim.recordId, { flagged: flagged ? 0 : 1 })
    } catch {
      setError('Could not update the flag.')
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <Textarea
          aria-label="Corrected value"
          rows={2}
          maxLength={500}
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
        />
        <div role="radiogroup" aria-label="Score" className="flex items-center gap-1">
          <span className="mr-1 text-xs text-muted-foreground">Score</span>
          {[0, ...SCORES].map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={draftScore === s}
              onClick={() => setDraftScore(s)}
              className={cn(
                'h-7 min-w-7 rounded-md border px-1.5 text-xs font-medium',
                draftScore === s ? 'border-primary bg-primary text-primary-foreground' : 'border-input text-muted-foreground hover:bg-accent',
              )}
              title={s === 0 ? 'No score' : `${s} of 5`}
            >
              {s === 0 ? '–' : s}
            </button>
          ))}
        </div>
        <Textarea
          aria-label="Why (optional)"
          placeholder="Why you changed it (optional)"
          rows={2}
          maxLength={1000}
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={save} loading={saving} disabled={saving}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('group flex flex-col gap-1.5', flagged && 'rounded-md ring-1 ring-warning/60 ring-offset-4 ring-offset-background')}>
      <div className="flex items-start gap-1.5">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {corrected ? (
            <Badge
              variant="outline"
              size="sm"
              title="You edited this cell. Re-running research keeps your version. The evidence below is what the AI originally found."
            >
              Corrected by you
            </Badge>
          ) : (
            <Badge variant={badge.variant} size="sm" title={badge.title}>
              {badge.label}
            </Badge>
          )}
          {c.score > 0 && <span className="text-xs text-muted-foreground">{c.score}/5</span>}
        </span>
        <span className="flex shrink-0 gap-0.5">
          <button
            type="button"
            onClick={toggleFlag}
            aria-pressed={flagged}
            aria-label={flagged ? 'Remove flag' : 'Flag for checking'}
            title={flagged ? 'Remove flag' : 'Flag for checking'}
            className={cn(
              'rounded p-1 hover:bg-accent',
              flagged ? 'text-warning' : 'text-muted-foreground opacity-60 group-hover:opacity-100',
            )}
          >
            <Flag className="size-3.5" fill={flagged ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={startEdit}
            aria-label="Correct this cell"
            title="Correct this cell"
            className="rounded p-1 text-muted-foreground opacity-60 hover:bg-accent group-hover:opacity-100"
          >
            <Pencil className="size-3.5" />
          </button>
        </span>
      </div>
      <p className={c.value ? '' : 'text-muted-foreground'}>{c.value || 'Not found'}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {(c.rationale || c.quote || source) && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground">
            {corrected ? 'Original AI evidence' : 'Evidence'}
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {c.rationale && <p>{c.rationale}</p>}
            {c.quote && (
              <blockquote className="border-l-2 border-border pl-2 italic text-foreground/80">“{c.quote}”</blockquote>
            )}
            {source && (
              <a href={source.url} target="_blank" rel="noreferrer noopener" className="underline hover:text-foreground">
                {hostnameOf(source.url) || source.url}
                {source.fetchedAt ? ` · read ${formatDate(source.fetchedAt)}` : ''}
              </a>
            )}
          </div>
        </details>
      )}
    </div>
  )
}
