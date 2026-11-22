/**
 * Validation for "create a decision". Shared by the form (instant feedback)
 * and the createDecision server action (the real check: a client can skip
 * the form and call the action directly).
 */

import { MAX_CANDIDATES } from '../schemas/candidates-schema'
import { MAX_CRITERIA, MAX_WEIGHT, MIN_WEIGHT } from '../schemas/criteria-schema'

export const MIN_CANDIDATES = 2
export const MIN_CRITERIA = 1

export type NewCandidate = { name: string; homepageUrl: string }
export type NewCriterion = { name: string; description: string; weight: number }
export type NewDecision = {
  question: string
  context: string
  candidates: NewCandidate[]
  criteria: NewCriterion[]
}

/** Field path → message, e.g. { 'candidates.1.name': 'Required' }. */
export type FieldErrors = Record<string, string>

export type ValidationResult =
  | { ok: true; value: NewDecision }
  | { ok: false; errors: FieldErrors }

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** Accepts untrusted input (anything from a request body) and returns clean data or errors. */
export function validateNewDecision(input: unknown): ValidationResult {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const errors: FieldErrors = {}

  const question = str(raw.question)
  if (!question) errors.question = 'Describe the decision you need to make.'
  else if (question.length > 300) errors.question = 'Keep the question under 300 characters.'

  const context = str(raw.context)
  if (context.length > 1000) errors.context = 'Keep the context under 1000 characters.'

  const rawCandidates = Array.isArray(raw.candidates) ? raw.candidates : []
  const candidates: NewCandidate[] = rawCandidates.map((c) => {
    const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
    return { name: str(o.name), homepageUrl: str(o.homepageUrl) }
  })
  if (candidates.length < MIN_CANDIDATES) {
    errors.candidates = `Add at least ${MIN_CANDIDATES} options to compare.`
  } else if (candidates.length > MAX_CANDIDATES) {
    errors.candidates = `Compare at most ${MAX_CANDIDATES} options.`
  }
  const seenCandidates = new Set<string>()
  candidates.forEach((c, i) => {
    const key = c.name.toLowerCase()
    if (!c.name) errors[`candidates.${i}.name`] = 'Name this option.'
    else if (c.name.length > 80) errors[`candidates.${i}.name`] = 'Keep the name under 80 characters.'
    else if (seenCandidates.has(key)) errors[`candidates.${i}.name`] = 'This option is listed twice.'
    seenCandidates.add(key)
    if (c.homepageUrl && (c.homepageUrl.length > 300 || !isHttpUrl(c.homepageUrl))) {
      errors[`candidates.${i}.homepageUrl`] = 'Use a full address starting with https://'
    }
  })

  const rawCriteria = Array.isArray(raw.criteria) ? raw.criteria : []
  const criteria: NewCriterion[] = rawCriteria.map((c) => {
    const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
    const weight = typeof o.weight === 'number' ? o.weight : 3
    return { name: str(o.name), description: str(o.description), weight }
  })
  if (criteria.length < MIN_CRITERIA) {
    errors.criteria = 'Add at least one criterion.'
  } else if (criteria.length > MAX_CRITERIA) {
    errors.criteria = `Use at most ${MAX_CRITERIA} criteria.`
  }
  const seenCriteria = new Set<string>()
  criteria.forEach((c, i) => {
    const key = c.name.toLowerCase()
    if (!c.name) errors[`criteria.${i}.name`] = 'Name this criterion.'
    else if (c.name.length > 60) errors[`criteria.${i}.name`] = 'Keep the name under 60 characters.'
    else if (seenCriteria.has(key)) errors[`criteria.${i}.name`] = 'This criterion is listed twice.'
    seenCriteria.add(key)
    if (c.description.length > 200) errors[`criteria.${i}.description`] = 'Keep this under 200 characters.'
    if (!Number.isInteger(c.weight) || c.weight < MIN_WEIGHT || c.weight > MAX_WEIGHT) {
      errors[`criteria.${i}.weight`] = `Weight must be a whole number from ${MIN_WEIGHT} to ${MAX_WEIGHT}.`
    }
  })

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { question, context, candidates, criteria } }
}
