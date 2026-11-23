/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { decisionsSchema } from './schemas/decisions-schema'
import { criteriaSchema } from './schemas/criteria-schema'
import { candidatesSchema } from './schemas/candidates-schema'
import { sourcesSchema } from './schemas/sources-schema'
import { claimsSchema } from './schemas/claims-schema'
import { snapshotsSchema } from './schemas/snapshots-schema'
import { usageSchema } from './schemas/usage-schema'
import { feedbackSchema } from './schemas/feedback-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  decisionsSchema,
  criteriaSchema,
  candidatesSchema,
  sourcesSchema,
  claimsSchema,
  snapshotsSchema,
  usageSchema,
  feedbackSchema,
]
