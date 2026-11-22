/**
 * Shared permission blocks for Decision Desk collections.
 *
 * Rule for the whole app: clients never create or delete rows directly.
 * Creation goes through server actions (which validate limits and stamp
 * ownership) or background jobs. Clients may only update the specific
 * fields listed in `writableFields`, and only on rows they own.
 *
 * New signed-in users get the 'member' role (ROLE_DEFAULT in the SDK);
 * 'viewer' is given the same read access but no writes.
 */

import type { CollectionSchema } from 'deepspace/schema'

type Permissions = CollectionSchema['permissions']

export function ownerOnly(writableFields: string[] = []): Permissions {
  const canUpdate = writableFields.length > 0
  return {
    '*': { read: false, create: false, update: false, delete: false },
    viewer: { read: 'own', create: false, update: false, delete: false },
    member: {
      read: 'own',
      create: false,
      update: canUpdate ? 'own' : false,
      delete: false,
      ...(canUpdate ? { writableFields } : {}),
    },
    admin: { read: true, create: true, update: true, delete: true },
  }
}

/** Owner column stamped by the server from the verified caller (rows created by actions). */
export const ownerColumnStamped = {
  name: 'ownerId',
  storage: 'text',
  interpretation: 'plain',
  userBound: true,
  immutable: true,
} as const

/**
 * Owner column set explicitly by server code (rows created by background jobs,
 * which act as the app owner, so userBound would stamp the wrong id). Safe
 * because no client role can create these rows.
 */
export const ownerColumnExplicit = {
  name: 'ownerId',
  storage: 'text',
  interpretation: 'plain',
  immutable: true,
  required: true,
} as const

export const plain = 'plain' as const
