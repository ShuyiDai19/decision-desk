import type { CollectionSchema } from 'deepspace/schema'
import { ownerColumnExplicit, ownerOnly, plain } from './permissions'

export const SOURCE_ORIGINS = ['search', 'user'] as const
export type SourceOrigin = (typeof SOURCE_ORIGINS)[number]

export type Source = {
  decisionId: string
  candidateId: string
  ownerId: string
  url: string
  title: string
  fetchedAt: string
  contentHash: string
  fetchOk: number
  origin: SourceOrigin
}

/** A web page a claim can cite. Page text is not stored; only its hash. */
export const sourcesSchema: CollectionSchema = {
  name: 'sources',
  columns: [
    { name: 'decisionId', storage: 'text', interpretation: plain, required: true, immutable: true },
    { name: 'candidateId', storage: 'text', interpretation: plain, required: true, immutable: true },
    ownerColumnExplicit,
    { name: 'url', storage: 'text', interpretation: { kind: 'url' }, required: true, maxLength: 1000 },
    { name: 'title', storage: 'text', interpretation: plain, maxLength: 300, default: '' },
    { name: 'fetchedAt', storage: 'text', interpretation: { kind: 'datetime' }, default: '' },
    { name: 'contentHash', storage: 'text', interpretation: plain, default: '' },
    { name: 'fetchOk', storage: 'number', interpretation: { kind: 'boolean' }, default: 0 },
    {
      name: 'origin',
      storage: 'text',
      interpretation: { kind: 'select', options: [...SOURCE_ORIGINS] },
      default: 'search',
    },
  ],
  ownerField: 'ownerId',
  // One row per page per candidate, so a retried job does not duplicate it.
  uniqueOn: ['candidateId', 'url'],
  permissions: ownerOnly(),
}
