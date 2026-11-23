import type { CollectionSchema } from 'deepspace/schema'
import { ownerOnly, plain } from './permissions'

export const STANCES = ['agree', 'concerns'] as const
export type Stance = (typeof STANCES)[number]

export type Feedback = {
  snapshotId: string
  /** Kept so deleting a decision can remove its feedback in one pass. */
  decisionId: string
  /** The decision author: the "owner" here, so they can read every response. */
  snapshotOwnerId: string
  /** The teammate who responded. */
  authorId: string
  /** JSON array holding authorId, so the responder can read their own row ('collaborator'). */
  authorIds: string
  /** Display name, written by the server from the user's profile (not the browser). */
  authorName: string
  stance: Stance
  comment: string
}

/**
 * A teammate's response to a shared decision: agree, or has concerns, plus an
 * optional comment. One per person per snapshot (submitting again updates it).
 *
 * Read access: the decision author sees every response; a responder sees only
 * their own. Other viewers of the link see none, so comments stay private to
 * the author. All writes go through the submitFeedback action.
 */
export const feedbackSchema: CollectionSchema = {
  name: 'feedback',
  columns: [
    { name: 'snapshotId', storage: 'text', interpretation: plain, required: true, immutable: true },
    { name: 'decisionId', storage: 'text', interpretation: plain, required: true, immutable: true },
    { name: 'snapshotOwnerId', storage: 'text', interpretation: plain, required: true, immutable: true },
    { name: 'authorId', storage: 'text', interpretation: plain, required: true, immutable: true },
    { name: 'authorIds', storage: 'text', interpretation: { kind: 'json' }, required: true, immutable: true },
    { name: 'authorName', storage: 'text', interpretation: plain, maxLength: 120, default: '' },
    { name: 'stance', storage: 'text', interpretation: { kind: 'select', options: [...STANCES] }, required: true },
    { name: 'comment', storage: 'text', interpretation: plain, maxLength: 500, default: '' },
  ],
  ownerField: 'snapshotOwnerId',
  collaboratorsField: 'authorIds',
  uniqueOn: ['snapshotId', 'authorId'],
  permissions: {
    ...ownerOnly(),
    viewer: { read: 'collaborator', create: false, update: false, delete: false },
    member: { read: 'collaborator', create: false, update: false, delete: false },
    admin: { read: 'collaborator', create: false, update: false, delete: false },
  },
}
