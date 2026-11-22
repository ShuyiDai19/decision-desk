/**
 * Copies the sample decision (a researched, reviewed decision the app owner
 * marked with isSample = 1) into the caller's account, so reviewers can try
 * the review and decide steps without waiting for or paying for research.
 *
 * Every row is copied with new ids and every reference between rows
 * (decisionId, candidateId, criterionId, sourceId) is remapped to the copy.
 * The copy is an ordinary decision owned by the caller.
 *
 * Takes a minimal record-store interface so it can be tested with a fake.
 */

type Row = { recordId: string; data: Record<string, unknown>; createdAt?: string }
type Result<T> = { success: true; data: T } | { success: false; error: string; code?: string }

export interface SampleStore {
  query(collection: string, opts: { where: Record<string, unknown>; limit?: number }): Promise<Result<{ records: Row[] }>>
  create(collection: string, data: Record<string, unknown>): Promise<Result<{ recordId: string }>>
}

const pick = (data: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.map((k) => [k, data[k]]))

async function rows(store: SampleStore, collection: string, where: Record<string, unknown>, limit = 200): Promise<Row[]> {
  const r = await store.query(collection, { where, limit })
  if (!r.success) throw new Error(r.error)
  return r.data.records
}

async function create(store: SampleStore, collection: string, data: Record<string, unknown>): Promise<string> {
  const r = await store.create(collection, data)
  if (!r.success) throw new Error(r.error)
  return r.data.recordId
}

export async function findSample(store: SampleStore): Promise<Row | undefined> {
  return (await rows(store, 'decisions', { isSample: 1 }, 1))[0]
}

/**
 * Copies the sample for `userId`. decisions/criteria/candidates get their
 * owner stamped by the record room (userBound); sources/claims set it here.
 */
export async function copySample(store: SampleStore, userId: string): Promise<{ decisionId: string } | null> {
  const sample = await findSample(store)
  if (!sample) return null
  const from = sample.recordId

  const [criteria, candidates, sources, claims] = await Promise.all([
    rows(store, 'criteria', { decisionId: from }),
    rows(store, 'candidates', { decisionId: from }),
    rows(store, 'sources', { decisionId: from }),
    rows(store, 'claims', { decisionId: from }),
  ])

  const decisionId = await create(store, 'decisions', {
    ...pick(sample.data, ['question', 'context']),
    status: 'reviewing',
    chosenCandidateId: '',
    isSample: 0,
  })

  const criterionMap = new Map<string, string>()
  for (const k of [...criteria].sort((a, b) => Number(a.data.order) - Number(b.data.order))) {
    criterionMap.set(k.recordId, await create(store, 'criteria', { decisionId, ...pick(k.data, ['name', 'description', 'weight', 'order']) }))
  }
  // Columns are shown in creation order, so copy options oldest first to keep the sample's column order.
  const byCreated = (a: Row, b: Row) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
  const candidateMap = new Map<string, string>()
  for (const c of [...candidates].sort(byCreated)) {
    candidateMap.set(
      c.recordId,
      await create(store, 'candidates', {
        decisionId,
        ...pick(c.data, ['name', 'homepageUrl', 'planBasis', 'progressNote']),
        researchStatus: 'done',
        jobId: '',
        error: '',
      }),
    )
  }
  const sourceMap = new Map<string, string>()
  for (const s of sources) {
    const candidateId = candidateMap.get(String(s.data.candidateId))
    if (!candidateId) continue
    sourceMap.set(
      s.recordId,
      await create(store, 'sources', {
        decisionId,
        candidateId,
        ownerId: userId,
        ...pick(s.data, ['url', 'title', 'fetchedAt', 'contentHash', 'fetchOk', 'origin']),
      }),
    )
  }
  for (const c of claims) {
    const candidateId = candidateMap.get(String(c.data.candidateId))
    const criterionId = criterionMap.get(String(c.data.criterionId))
    if (!candidateId || !criterionId) continue
    await create(store, 'claims', {
      decisionId,
      candidateId,
      criterionId,
      ownerId: userId,
      sourceId: sourceMap.get(String(c.data.sourceId)) ?? '',
      ...pick(c.data, ['value', 'score', 'rationale', 'quote', 'verification', 'origin', 'flagged']),
    })
  }
  return { decisionId }
}
