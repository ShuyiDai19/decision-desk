import type { CollectionSchema } from 'deepspace/schema'
import { ownerOnly, plain } from './permissions'

export const MAX_RESEARCH_RUNS_PER_DAY = 3

export type Usage = {
  userId: string
  /** UTC date, YYYY-MM-DD. */
  day: string
  researchRuns: number
}

/**
 * Per-user daily research quota. Exa and OpenAI are billed to the app owner
 * and the platform does not rate-limit them, so the app enforces its own cap.
 */
export const usageSchema: CollectionSchema = {
  name: 'usage',
  columns: [
    { name: 'userId', storage: 'text', interpretation: plain, userBound: true, immutable: true },
    { name: 'day', storage: 'text', interpretation: plain, required: true, immutable: true },
    { name: 'researchRuns', storage: 'number', interpretation: plain, default: 0 },
  ],
  ownerField: 'userId',
  uniqueOn: ['userId', 'day'],
  permissions: ownerOnly(),
}
