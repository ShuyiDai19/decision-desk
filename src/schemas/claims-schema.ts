import type { CollectionSchema } from 'deepspace/schema'
import { ownerColumnExplicit, ownerOnly, plain } from './permissions'

export const VERIFICATIONS = ['verified', 'unverified', 'not_found', 'user_provided'] as const
export type Verification = (typeof VERIFICATIONS)[number]
export const CLAIM_ORIGINS = ['ai', 'user'] as const
export type ClaimOrigin = (typeof CLAIM_ORIGINS)[number]

export type Claim = {
  decisionId: string
  candidateId: string
  criterionId: string
  ownerId: string
  value: string
  /** 1–5, or 0 when there is no score. */
  score: number
  rationale: string
  sourceId: string
  quote: string
  verification: Verification
  origin: ClaimOrigin
  flagged: number
}

/**
 * One cell of the comparison table: what a candidate offers on one criterion.
 *
 * Users may correct value/score/rationale and flag a cell, but cannot touch
 * sourceId, quote or verification. So an edited cell can never pretend to be
 * a verified AI quote. The UI shows origin = 'user' as "corrected by you".
 */
export const claimsSchema: CollectionSchema = {
  name: 'claims',
  columns: [
    { name: 'decisionId', storage: 'text', interpretation: plain, required: true, immutable: true },
    { name: 'candidateId', storage: 'text', interpretation: plain, required: true, immutable: true },
    { name: 'criterionId', storage: 'text', interpretation: plain, required: true, immutable: true },
    ownerColumnExplicit,
    { name: 'value', storage: 'text', interpretation: plain, maxLength: 500, default: '' },
    { name: 'score', storage: 'number', interpretation: plain, default: 0 },
    { name: 'rationale', storage: 'text', interpretation: plain, maxLength: 1000, default: '' },
    { name: 'sourceId', storage: 'text', interpretation: plain, default: '' },
    { name: 'quote', storage: 'text', interpretation: plain, maxLength: 400, default: '' },
    {
      name: 'verification',
      storage: 'text',
      interpretation: { kind: 'select', options: [...VERIFICATIONS] },
      default: 'not_found',
    },
    {
      name: 'origin',
      storage: 'text',
      interpretation: { kind: 'select', options: [...CLAIM_ORIGINS] },
      default: 'ai',
    },
    { name: 'flagged', storage: 'number', interpretation: { kind: 'boolean' }, default: 0 },
  ],
  ownerField: 'ownerId',
  uniqueOn: ['candidateId', 'criterionId'],
  permissions: ownerOnly(['value', 'score', 'rationale', 'origin', 'flagged']),
}
