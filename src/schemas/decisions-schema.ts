import type { CollectionSchema } from 'deepspace/schema'
import { ownerColumnStamped, ownerOnly, plain } from './permissions'

export const DECISION_STATUSES = ['draft', 'researching', 'reviewing', 'decided'] as const
export type DecisionStatus = (typeof DECISION_STATUSES)[number]

export type Decision = {
  ownerId: string
  question: string
  context: string
  status: DecisionStatus
  chosenCandidateId: string
  isSample: number
}

/** One decision: the question being answered and its lifecycle status. */
export const decisionsSchema: CollectionSchema = {
  name: 'decisions',
  columns: [
    ownerColumnStamped,
    { name: 'question', storage: 'text', interpretation: plain, required: true, maxLength: 300 },
    { name: 'context', storage: 'text', interpretation: plain, maxLength: 1000, default: '' },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: [...DECISION_STATUSES] },
      default: 'draft',
    },
    { name: 'chosenCandidateId', storage: 'text', interpretation: plain, default: '' },
    { name: 'isSample', storage: 'number', interpretation: { kind: 'boolean' }, default: 0 },
  ],
  ownerField: 'ownerId',
  // Status and the chosen candidate change only through server actions.
  permissions: ownerOnly(['question', 'context']),
}
