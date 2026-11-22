import type { CollectionSchema } from 'deepspace/schema'
import { ownerColumnStamped, plain } from './permissions'

export const VISIBILITIES = ['private', 'public'] as const
export type Visibility = (typeof VISIBILITIES)[number]

export type Snapshot = {
  decisionId: string
  ownerId: string
  version: number
  chosenCandidateId: string
  /** Frozen table: criteria, weights, candidates, claims, sources, scores. */
  payload: unknown
  briefMarkdown: string
  visibility: Visibility
  emailedAt: string
}

/**
 * An immutable copy of a finalized decision. Shared links and emails point
 * here, so later edits to the live decision never change what was shared.
 *
 * Known tradeoff: 'published' lets signed-out visitors read every public
 * snapshot, not just the one they were linked to. Snapshot ids are
 * unguessable and nothing sensitive is stored, so this is acceptable here.
 */
export const snapshotsSchema: CollectionSchema = {
  name: 'snapshots',
  columns: [
    { name: 'decisionId', storage: 'text', interpretation: plain, required: true, immutable: true },
    ownerColumnStamped,
    { name: 'version', storage: 'number', interpretation: plain, required: true, immutable: true },
    { name: 'chosenCandidateId', storage: 'text', interpretation: plain, immutable: true },
    { name: 'payload', storage: 'text', interpretation: { kind: 'json' }, required: true, immutable: true },
    { name: 'briefMarkdown', storage: 'text', interpretation: plain, default: '', immutable: true },
    {
      name: 'visibility',
      storage: 'text',
      interpretation: { kind: 'select', options: [...VISIBILITIES] },
      default: 'private',
    },
    { name: 'emailedAt', storage: 'text', interpretation: { kind: 'datetime' }, default: '' },
  ],
  ownerField: 'ownerId',
  visibilityField: { field: 'visibility', value: 'public' },
  uniqueOn: ['decisionId', 'version'],
  // Visibility and emailedAt change only through server actions.
  permissions: {
    '*': { read: 'published', create: false, update: false, delete: false },
    viewer: { read: 'published', create: false, update: false, delete: false },
    member: { read: 'published', create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
