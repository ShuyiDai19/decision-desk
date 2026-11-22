import type { BadgeProps } from '@/components/ui'
import type { DecisionStatus } from '../../schemas/decisions-schema'
import type { ResearchStatus } from '../../schemas/candidates-schema'

type Variant = NonNullable<BadgeProps['variant']>

export const DECISION_STATUS_LABEL: Record<DecisionStatus, { label: string; variant: Variant }> = {
  draft: { label: 'Draft', variant: 'outline' },
  researching: { label: 'Researching', variant: 'info' },
  reviewing: { label: 'Ready to review', variant: 'warning' },
  decided: { label: 'Decided', variant: 'success' },
}

export const RESEARCH_STATUS_LABEL: Record<ResearchStatus, string> = {
  idle: 'Not researched yet',
  queued: 'Waiting to start',
  searching: 'Searching official pages',
  extracting: 'Reading and extracting',
  done: 'Research complete',
  failed: 'Research failed',
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
