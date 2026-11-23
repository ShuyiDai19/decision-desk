import type { CollectionSchema } from 'deepspace/schema'
import { ownerColumnStamped, ownerOnly, plain } from './permissions'

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
  /** Secret part of the share link; '' while sharing is off. See src/lib/share.ts. */
  shareToken: string
  emailedAt: string
}

/**
 * An immutable copy of a finalized decision. Shared links and emails point
 * here, so later edits to the live decision never change what was shared.
 *
 * Readable by its owner only. Others reach a shared snapshot solely through
 * its share link (/share/<token>), served one at a time by the
 * GET /api/shared/:token route, so snapshots can't be listed or browsed.
 * `visibility` is the owner's sharing switch; `shareToken` is set while it is on.
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
    { name: 'shareToken', storage: 'text', interpretation: plain, default: '' },
    { name: 'emailedAt', storage: 'text', interpretation: { kind: 'datetime' }, default: '' },
  ],
  ownerField: 'ownerId',
  uniqueOn: ['decisionId', 'version'],
  // Owner-only reads; visibility, shareToken and emailedAt change only through server actions.
  permissions: ownerOnly(),
}
