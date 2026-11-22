import type { CollectionSchema } from 'deepspace/schema'
import { ownerColumnStamped, ownerOnly, plain } from './permissions'

export const MAX_CRITERIA = 5
export const MIN_WEIGHT = 1
export const MAX_WEIGHT = 5

export type Criterion = {
  decisionId: string
  ownerId: string
  name: string
  description: string
  weight: number
  order: number
}

/** A criterion the candidates are judged on, with a user-set weight (1–5). */
export const criteriaSchema: CollectionSchema = {
  name: 'criteria',
  columns: [
    { name: 'decisionId', storage: 'text', interpretation: plain, required: true, immutable: true },
    ownerColumnStamped,
    { name: 'name', storage: 'text', interpretation: plain, required: true, maxLength: 60 },
    { name: 'description', storage: 'text', interpretation: plain, maxLength: 200, default: '' },
    { name: 'weight', storage: 'number', interpretation: plain, default: 3 },
    { name: 'order', storage: 'number', interpretation: plain, default: 0 },
  ],
  ownerField: 'ownerId',
  // Weight changes are the main review interaction, so the client writes them
  // directly. The UI clamps to 1–5; scoring clamps again (see src/lib/score.ts).
  permissions: ownerOnly(['weight', 'description']),
}
