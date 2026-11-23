/**
 * Deletes a decision and everything that belongs to it.
 *
 * Children go first and the decision row last: if a step fails part-way,
 * the decision is still on the user's list and deleting again finishes the
 * job, instead of leaving rows behind that no page can reach.
 *
 * deleteWhere removes at most `limit` rows per call (SDK cap 500), so each
 * collection is drained in a loop.
 */

type Result<T> = { success: true; data: T } | { success: false; error: string }

export interface DeleteStore {
  deleteWhere(collection: string, where: Record<string, unknown>, limit?: number): Promise<Result<{ deleted: number }>>
  remove(collection: string, recordId: string): Promise<Result<unknown>>
}

/** Order matters only in that `decisions` is last; children are independent of each other. */
export const CHILD_COLLECTIONS = ['claims', 'sources', 'candidates', 'criteria', 'feedback', 'snapshots'] as const

const BATCH = 500

export async function deleteDecisionCascade(store: DeleteStore, decisionId: string): Promise<{ deleted: number }> {
  let deleted = 0
  for (const collection of CHILD_COLLECTIONS) {
    for (;;) {
      const r = await store.deleteWhere(collection, { decisionId }, BATCH)
      if (!r.success) throw new Error(`Could not delete ${collection}: ${r.error}`)
      deleted += r.data.deleted
      if (r.data.deleted < BATCH) break
    }
  }
  const r = await store.remove('decisions', decisionId)
  if (!r.success) throw new Error(`Could not delete the decision: ${r.error}`)
  return { deleted: deleted + 1 }
}
