import type { CollectionSchema } from 'deepspace/schema'
import { ownerColumnStamped, ownerOnly, plain } from './permissions'

export const MAX_CANDIDATES = 3
export const RESEARCH_STATUSES = ['idle', 'queued', 'searching', 'extracting', 'done', 'failed'] as const
export type ResearchStatus = (typeof RESEARCH_STATUSES)[number]

export type Candidate = {
  decisionId: string
  ownerId: string
  name: string
  homepageUrl: string
  researchStatus: ResearchStatus
  progressNote: string
  /** The one plan research evaluated, e.g. "Suite Team". Empty until researched. */
  planBasis: string
  jobId: string
  error: string
}

/**
 * A product being compared. Its research status is the durable progress
 * record (job rows are garbage-collected after 24h, these are not).
 */
export const candidatesSchema: CollectionSchema = {
  name: 'candidates',
  columns: [
    { name: 'decisionId', storage: 'text', interpretation: plain, required: true, immutable: true },
    ownerColumnStamped,
    { name: 'name', storage: 'text', interpretation: plain, required: true, maxLength: 80 },
    { name: 'homepageUrl', storage: 'text', interpretation: { kind: 'url' }, maxLength: 300, default: '' },
    {
      name: 'researchStatus',
      storage: 'text',
      interpretation: { kind: 'select', options: [...RESEARCH_STATUSES] },
      default: 'idle',
    },
    { name: 'progressNote', storage: 'text', interpretation: plain, maxLength: 200, default: '' },
    { name: 'planBasis', storage: 'text', interpretation: plain, maxLength: 200, default: '' },
    { name: 'jobId', storage: 'text', interpretation: plain, default: '' },
    { name: 'error', storage: 'text', interpretation: plain, maxLength: 500, default: '' },
  ],
  ownerField: 'ownerId',
  // Everything here is written by actions and the research job.
  permissions: ownerOnly(),
}
