/**
 * TEMPORARY — platform probe. Delete once the real research job exists.
 *
 * Answers two questions from docs/DESIGN.md:
 *   1. Can a background job write records that the page sees in real time?
 *   2. Can a server action enqueue a job?
 * It also exercises the ownership pattern the real collections will use:
 * `ownerId` is stamped by the server (userBound) and checked by 'own'.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const probesSchema: CollectionSchema = {
  name: 'probes',
  columns: [
    { name: 'ownerId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'status', storage: 'text', interpretation: 'plain' },
    { name: 'step', storage: 'number', interpretation: 'plain' },
  ],
  ownerField: 'ownerId',
  permissions: {
    viewer: { read: 'own', create: false, update: false, delete: false },
    member: { read: 'own', create: false, update: false, delete: false },
    admin: { read: true, create: false, update: false, delete: true },
  },
}
