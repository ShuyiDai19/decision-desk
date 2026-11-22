/**
 * Weighted scoring for the comparison table.
 *
 * The AI suggests a 1–5 score per cell; the total is computed here, in code,
 * never by the model. Used by the page (live recompute while dragging a
 * weight) and by the server when freezing a snapshot, so both always agree.
 *
 *   total(c) = Σ weight(k) · score(c, k) / Σ weight(k)
 *
 * over the criteria k where candidate c HAS a score. Missing scores are left
 * out of both sums, and `covered` / `total` is reported next to the score, so
 * a candidate with little information cannot look good by having gaps.
 */

import { MAX_WEIGHT, MIN_WEIGHT } from '../schemas/criteria-schema'

export type ScoreCriterion = { id: string; weight: number }
export type ScoreClaim = { candidateId: string; criterionId: string; score: number }

export type CandidateScore = {
  candidateId: string
  /** Weighted average on the 1–5 scale, or null when no criterion is scored. */
  score: number | null
  /** Number of criteria with a usable score. */
  covered: number
  /** Number of criteria in the decision. */
  total: number
}

const MIN_SCORE = 1
const MAX_SCORE = 5

/** Weights outside 1–5 (or not numbers) are clamped; NaN becomes the minimum. */
export function clampWeight(weight: number): number {
  if (!Number.isFinite(weight)) return MIN_WEIGHT
  return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, Math.round(weight)))
}

/** A usable score is an integer 1–5. 0 means "no score"; anything else is ignored. */
function usableScore(score: number): number | null {
  if (!Number.isFinite(score)) return null
  const rounded = Math.round(score)
  return rounded >= MIN_SCORE && rounded <= MAX_SCORE ? rounded : null
}

export function scoreCandidates(
  candidateIds: string[],
  criteria: ScoreCriterion[],
  claims: ScoreClaim[],
): CandidateScore[] {
  const weights = new Map(criteria.map((c) => [c.id, clampWeight(c.weight)]))
  const cell = new Map<string, number>()
  for (const claim of claims) {
    if (!weights.has(claim.criterionId)) continue // claim for a deleted criterion
    const s = usableScore(claim.score)
    if (s !== null) cell.set(`${claim.candidateId}|${claim.criterionId}`, s)
  }

  return candidateIds.map((candidateId) => {
    let weighted = 0
    let weightSum = 0
    let covered = 0
    for (const [criterionId, weight] of weights) {
      const s = cell.get(`${candidateId}|${criterionId}`)
      if (s === undefined) continue
      weighted += weight * s
      weightSum += weight
      covered += 1
    }
    return {
      candidateId,
      score: weightSum > 0 ? Math.round((weighted / weightSum) * 100) / 100 : null,
      covered,
      total: criteria.length,
    }
  })
}

/**
 * Order for display: highest score first; unscored candidates last; ties
 * broken by coverage, then by the original order (stable sort).
 */
export function rankCandidates(scores: CandidateScore[]): CandidateScore[] {
  return [...scores].sort((a, b) => {
    if (a.score === null && b.score === null) return b.covered - a.covered
    if (a.score === null) return 1
    if (b.score === null) return -1
    if (b.score !== a.score) return b.score - a.score
    return b.covered - a.covered
  })
}
