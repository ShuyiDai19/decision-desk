import { describe, expect, it } from 'vitest'
import { clampWeight, rankCandidates, scoreCandidates } from './score'

const criteria = [
  { id: 'price', weight: 5 },
  { id: 'kb', weight: 3 },
  { id: 'email', weight: 1 },
]

describe('scoreCandidates', () => {
  it('computes the weighted average over all scored criteria', () => {
    const [r] = scoreCandidates(['a'], criteria, [
      { candidateId: 'a', criterionId: 'price', score: 4 },
      { candidateId: 'a', criterionId: 'kb', score: 2 },
      { candidateId: 'a', criterionId: 'email', score: 5 },
    ])
    // (5·4 + 3·2 + 1·5) / 9 = 31 / 9 = 3.444…
    expect(r).toEqual({ candidateId: 'a', score: 3.44, covered: 3, total: 3 })
  })

  it('leaves missing scores out of the average and reports coverage', () => {
    const [r] = scoreCandidates(['a'], criteria, [
      { candidateId: 'a', criterionId: 'price', score: 2 },
      { candidateId: 'a', criterionId: 'kb', score: 0 }, // 0 = not scored
    ])
    expect(r).toEqual({ candidateId: 'a', score: 2, covered: 1, total: 3 })
  })

  it('returns null, not 0, when nothing is scored', () => {
    const [r] = scoreCandidates(['a'], criteria, [])
    expect(r).toEqual({ candidateId: 'a', score: null, covered: 0, total: 3 })
  })

  it('handles a decision with no criteria', () => {
    const [r] = scoreCandidates(['a'], [], [{ candidateId: 'a', criterionId: 'x', score: 5 }])
    expect(r).toEqual({ candidateId: 'a', score: null, covered: 0, total: 0 })
  })

  it('ignores out-of-range scores and claims for unknown criteria', () => {
    const [r] = scoreCandidates(['a'], criteria, [
      { candidateId: 'a', criterionId: 'price', score: 9 },
      { candidateId: 'a', criterionId: 'kb', score: Number.NaN },
      { candidateId: 'a', criterionId: 'deleted', score: 5 },
      { candidateId: 'a', criterionId: 'email', score: 3 },
    ])
    expect(r).toEqual({ candidateId: 'a', score: 3, covered: 1, total: 3 })
  })

  it('clamps weights a client may have written out of range', () => {
    const [r] = scoreCandidates(
      ['a'],
      [
        { id: 'price', weight: 100 }, // → 5
        { id: 'kb', weight: -3 }, // → 1
      ],
      [
        { candidateId: 'a', criterionId: 'price', score: 5 },
        { candidateId: 'a', criterionId: 'kb', score: 1 },
      ],
    )
    // (5·5 + 1·1) / 6 = 4.333…
    expect(r.score).toBe(4.33)
  })

  it("keeps candidates separate and does not mix up each other's cells", () => {
    const out = scoreCandidates(['a', 'b'], criteria, [
      { candidateId: 'a', criterionId: 'price', score: 5 },
      { candidateId: 'b', criterionId: 'price', score: 1 },
    ])
    expect(out.map((r) => r.score)).toEqual([5, 1])
  })

  it('changes the result when a weight changes (live slider behaviour)', () => {
    const claims = [
      { candidateId: 'a', criterionId: 'price', score: 5 },
      { candidateId: 'a', criterionId: 'kb', score: 1 },
    ]
    const priceHeavy = scoreCandidates(['a'], [{ id: 'price', weight: 5 }, { id: 'kb', weight: 1 }], claims)
    const kbHeavy = scoreCandidates(['a'], [{ id: 'price', weight: 1 }, { id: 'kb', weight: 5 }], claims)
    expect(priceHeavy[0].score).toBeGreaterThan(kbHeavy[0].score!)
  })
})

describe('clampWeight', () => {
  it('rounds and clamps into 1–5', () => {
    expect([clampWeight(0), clampWeight(2.6), clampWeight(7), clampWeight(Number.NaN)]).toEqual([1, 3, 5, 1])
  })
})

describe('rankCandidates', () => {
  it('sorts by score, puts unscored last, and breaks ties by coverage', () => {
    const ranked = rankCandidates([
      { candidateId: 'none', score: null, covered: 0, total: 3 },
      { candidateId: 'thin', score: 4, covered: 1, total: 3 },
      { candidateId: 'full', score: 4, covered: 3, total: 3 },
      { candidateId: 'low', score: 2, covered: 3, total: 3 },
    ])
    expect(ranked.map((r) => r.candidateId)).toEqual(['full', 'thin', 'low', 'none'])
  })
})
