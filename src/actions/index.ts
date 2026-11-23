import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { createDecision } from './create-decision'
import { startResearch } from './start-research'
import { emailSnapshot, finalizeDecision, setSnapshotVisibility } from './finalize'
import { appInfo, copySample, markAsSample } from './sample'
import { deleteDecision } from './delete-decision'
import { submitFeedback } from './feedback'

/**
 * Server actions run with per-record RBAC OFF (see src/server/action-routes.ts).
 * Every action that touches existing records must check ownership itself.
 */
export const actions: Record<string, ActionHandler<Env>> = {
  createDecision,
  deleteDecision,
  startResearch,
  finalizeDecision,
  setSnapshotVisibility,
  emailSnapshot,
  submitFeedback,
  appInfo,
  markAsSample,
  copySample,
}
