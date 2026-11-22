/**
 * /decisions/new: describe the decision, list 2–3 options and 1–5 criteria.
 *
 * Validation runs here for instant feedback and again in the createDecision
 * action (the real check). Both use src/lib/decision-input.ts.
 */

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { Button, Input, Label, Textarea, cn } from '@/components/ui'
import { callAction } from '@/lib/call-action'
import {
  MIN_CANDIDATES,
  MIN_CRITERIA,
  validateNewDecision,
  type FieldErrors,
  type NewCandidate,
  type NewCriterion,
} from '@/lib/decision-input'
import { MAX_CANDIDATES } from '../../../../schemas/candidates-schema'
import { MAX_CRITERIA, MAX_WEIGHT, MIN_WEIGHT } from '../../../../schemas/criteria-schema'

const emptyCandidate = (): NewCandidate => ({ name: '', homepageUrl: '' })
const emptyCriterion = (): NewCriterion => ({ name: '', description: '', weight: 3 })

const EXAMPLE = {
  question: 'Which customer support tool should our 3-person team adopt?',
  context: 'Budget is about $100/month in total. We need a knowledge base and shared email support.',
  candidates: [
    { name: 'Help Scout', homepageUrl: 'https://www.helpscout.com' },
    { name: 'Zendesk', homepageUrl: 'https://www.zendesk.com' },
    { name: 'Freshdesk', homepageUrl: 'https://www.freshworks.com/freshdesk/' },
  ],
  criteria: [
    { name: 'Price for 3 agents', description: 'Monthly cost on the cheapest plan that fits', weight: 5 },
    { name: 'Knowledge base', description: 'Public help center included on that plan', weight: 4 },
    { name: 'Email support inbox', description: 'Shared inbox for customer email', weight: 4 },
    { name: 'Setup effort', description: 'How quickly a small team can get started', weight: 2 },
  ],
}

export default function NewDecisionPage() {
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const [context, setContext] = useState('')
  const [candidates, setCandidates] = useState<NewCandidate[]>([emptyCandidate(), emptyCandidate()])
  const [criteria, setCriteria] = useState<NewCriterion[]>([emptyCriterion()])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const updateCandidate = (i: number, patch: Partial<NewCandidate>) =>
    setCandidates((list) => list.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const updateCriterion = (i: number, patch: Partial<NewCriterion>) =>
    setCriteria((list) => list.map((c, j) => (j === i ? { ...c, ...patch } : c)))

  function fillExample() {
    setQuestion(EXAMPLE.question)
    setContext(EXAMPLE.context)
    setCandidates(EXAMPLE.candidates.map((c) => ({ ...c })))
    setCriteria(EXAMPLE.criteria.map((c) => ({ ...c })))
    setErrors({})
    setFormError('')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError('')
    const input = { question, context, candidates, criteria }
    const local = validateNewDecision(input)
    if (!local.ok) {
      setErrors(local.errors)
      setFormError('Please fix the highlighted fields.')
      return
    }
    setErrors({})
    setSubmitting(true)
    const res = await callAction<{ decisionId: string }>('createDecision', local.value)
    setSubmitting(false)
    if (res.success) {
      navigate(`/decisions/${res.data.decisionId}`)
      return
    }
    setErrors(res.details?.fieldErrors ?? {})
    setFormError(res.error)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New decision</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Up to {MAX_CANDIDATES} options and {MAX_CRITERIA} criteria. Fewer, sharper criteria give a clearer answer.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={fillExample}>
          Use an example
        </Button>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-10" noValidate>
        <section className="flex flex-col gap-4">
          <Field label="What are you deciding?" error={errors.question} htmlFor="question">
            <Textarea
              id="question"
              rows={2}
              value={question}
              maxLength={300}
              placeholder="Which customer support tool should our team adopt?"
              onChange={(e) => setQuestion(e.target.value)}
              aria-invalid={!!errors.question}
            />
          </Field>
          <Field
            label="Context"
            hint="Optional. Budget, team size, must-haves. Research uses this."
            error={errors.context}
            htmlFor="context"
          >
            <Textarea
              id="context"
              rows={3}
              value={context}
              maxLength={1000}
              onChange={(e) => setContext(e.target.value)}
              aria-invalid={!!errors.context}
            />
          </Field>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader
            title="Options to compare"
            hint={`${MIN_CANDIDATES}–${MAX_CANDIDATES}. Add the official website if you know it; it keeps research on the right pages.`}
            error={errors.candidates}
          />
          {candidates.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] items-start gap-2">
              <Field error={errors[`candidates.${i}.name`]}>
                <Input
                  aria-label={`Option ${i + 1} name`}
                  placeholder={`Option ${i + 1}`}
                  value={c.name}
                  maxLength={80}
                  onChange={(e) => updateCandidate(i, { name: e.target.value })}
                  aria-invalid={!!errors[`candidates.${i}.name`]}
                />
              </Field>
              <Field error={errors[`candidates.${i}.homepageUrl`]}>
                <Input
                  aria-label={`Option ${i + 1} website`}
                  placeholder="https://… (optional)"
                  value={c.homepageUrl}
                  maxLength={300}
                  inputMode="url"
                  onChange={(e) => updateCandidate(i, { homepageUrl: e.target.value })}
                  aria-invalid={!!errors[`candidates.${i}.homepageUrl`]}
                />
              </Field>
              <RemoveButton
                label={`Remove option ${i + 1}`}
                disabled={candidates.length <= MIN_CANDIDATES}
                onClick={() => setCandidates((list) => list.filter((_, j) => j !== i))}
              />
            </div>
          ))}
          {candidates.length < MAX_CANDIDATES && (
            <AddButton onClick={() => setCandidates((list) => [...list, emptyCandidate()])}>Add option</AddButton>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader
            title="What matters"
            hint={`${MIN_CRITERIA}–${MAX_CRITERIA} criteria. Weight 5 = matters most. You can change weights later.`}
            error={errors.criteria}
          />
          {criteria.map((c, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="grid grid-cols-[1fr_auto_auto] items-start gap-2">
                <Field error={errors[`criteria.${i}.name`]}>
                  <Input
                    aria-label={`Criterion ${i + 1} name`}
                    placeholder="e.g. Price for 3 agents"
                    value={c.name}
                    maxLength={60}
                    onChange={(e) => updateCriterion(i, { name: e.target.value })}
                    aria-invalid={!!errors[`criteria.${i}.name`]}
                  />
                </Field>
                <WeightPicker value={c.weight} onChange={(weight) => updateCriterion(i, { weight })} index={i} />
                <RemoveButton
                  label={`Remove criterion ${i + 1}`}
                  disabled={criteria.length <= MIN_CRITERIA}
                  onClick={() => setCriteria((list) => list.filter((_, j) => j !== i))}
                />
              </div>
              <Field error={errors[`criteria.${i}.description`]}>
                <Input
                  aria-label={`Criterion ${i + 1} details`}
                  placeholder="What exactly to look for (optional)"
                  value={c.description}
                  maxLength={200}
                  onChange={(e) => updateCriterion(i, { description: e.target.value })}
                />
              </Field>
            </div>
          ))}
          {criteria.length < MAX_CRITERIA && (
            <AddButton onClick={() => setCriteria((list) => [...list, emptyCriterion()])}>Add criterion</AddButton>
          )}
        </section>

        <div className="flex items-center justify-end gap-4 border-t border-border pt-6">
          {formError && (
            <p role="alert" className="mr-auto text-sm text-destructive">
              {formError}
            </p>
          )}
          <Button type="button" variant="ghost" onClick={() => navigate('/home')}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={submitting}>
            Create decision
          </Button>
        </div>
      </form>
    </div>
  )
}

function Field(props: { label?: string; hint?: string; error?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {props.label && <Label htmlFor={props.htmlFor}>{props.label}</Label>}
      {props.hint && <p className="text-xs text-muted-foreground">{props.hint}</p>}
      {props.children}
      {props.error && <p className="text-xs text-destructive">{props.error}</p>}
    </div>
  )
}

function SectionHeader({ title, hint, error }: { title: string; hint: string; error?: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

function WeightPicker({ value, onChange, index }: { value: number; onChange: (w: number) => void; index: number }) {
  const weights = Array.from({ length: MAX_WEIGHT - MIN_WEIGHT + 1 }, (_, k) => MIN_WEIGHT + k)
  return (
    <div role="radiogroup" aria-label={`Weight for criterion ${index + 1}`} className="flex h-10 items-center gap-1">
      {weights.map((w) => (
        <button
          key={w}
          type="button"
          role="radio"
          aria-checked={value === w}
          onClick={() => onChange(w)}
          className={cn(
            'size-8 rounded-md border text-xs font-medium transition-colors',
            value === w
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input text-muted-foreground hover:bg-accent',
          )}
        >
          {w}
        </button>
      ))}
    </div>
  )
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="self-start" onClick={onClick}>
      <Plus /> {children}
    </Button>
  )
}

function RemoveButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} disabled={disabled} onClick={onClick}>
      <X />
    </Button>
  )
}
