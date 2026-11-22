/**
 * Snapshot + decision brief.
 *
 * A snapshot freezes the reviewed table at the moment a decision is made:
 * weights, every cell (with its quote and source), scores and the chosen
 * option. The brief is a short write-up generated from that frozen data only.
 *
 * Every fact in the brief cites a numbered cell like [3]. The renderer turns
 * those into links to the cell's source, so a reader can check any sentence.
 * Citations to numbers that don't exist are dropped, and if the AI call
 * fails, a plain template brief is used so finalizing never breaks.
 *
 * Pure functions: used by the finalize action, the snapshot page and email.
 */

import { rankCandidates, scoreCandidates } from './score'
import type { Verification, ClaimOrigin } from '../schemas/claims-schema'

export type SnapshotClaim = {
  /** 1-based number used in brief citations. */
  n: number
  candidateId: string
  criterionId: string
  value: string
  score: number
  rationale: string
  quote: string
  verification: Verification
  origin: ClaimOrigin
  flagged: boolean
  source: { url: string; title: string; fetchedAt: string } | null
}

export type SnapshotPayload = {
  format: 1
  question: string
  context: string
  finalizedAt: string
  chosenCandidateId: string
  criteria: { id: string; name: string; description: string; weight: number }[]
  candidates: {
    id: string
    name: string
    homepageUrl: string
    planBasis: string
    score: number | null
    covered: number
    total: number
  }[]
  claims: SnapshotClaim[]
  briefSource: 'ai' | 'template'
}

export type SnapshotInput = {
  question: string
  context: string
  chosenCandidateId: string
  finalizedAt: string
  criteria: { id: string; name: string; description: string; weight: number; order: number }[]
  candidates: { id: string; name: string; homepageUrl: string; planBasis: string }[]
  claims: (Omit<SnapshotClaim, 'n' | 'source' | 'flagged'> & { flagged: number; sourceId: string })[]
  sources: { id: string; url: string; title: string; fetchedAt: string }[]
}

/** Freezes the table. Claims are numbered row by row (criteria order), then column by column. */
export function buildSnapshotPayload(input: SnapshotInput): Omit<SnapshotPayload, 'briefSource'> {
  const criteria = [...input.criteria].sort((a, b) => a.order - b.order)
  const sourceById = new Map(input.sources.map((s) => [s.id, s]))
  const claims: SnapshotClaim[] = []
  for (const k of criteria) {
    for (const c of input.candidates) {
      const claim = input.claims.find((x) => x.candidateId === c.id && x.criterionId === k.id)
      if (!claim) continue
      const src = sourceById.get(claim.sourceId)
      claims.push({
        n: claims.length + 1,
        candidateId: claim.candidateId,
        criterionId: claim.criterionId,
        value: claim.value,
        score: claim.score,
        rationale: claim.rationale,
        quote: claim.quote,
        verification: claim.verification,
        origin: claim.origin,
        flagged: claim.flagged === 1,
        source: src ? { url: src.url, title: src.title, fetchedAt: src.fetchedAt } : null,
      })
    }
  }
  const scores = scoreCandidates(
    input.candidates.map((c) => c.id),
    criteria.map((k) => ({ id: k.id, weight: k.weight })),
    claims.map((c) => ({ candidateId: c.candidateId, criterionId: c.criterionId, score: c.score })),
  )
  const scoreOf = new Map(scores.map((s) => [s.candidateId, s]))
  return {
    format: 1,
    question: input.question,
    context: input.context,
    finalizedAt: input.finalizedAt,
    chosenCandidateId: input.chosenCandidateId,
    criteria: criteria.map(({ id, name, description, weight }) => ({ id, name, description, weight })),
    candidates: input.candidates.map((c) => {
      const s = scoreOf.get(c.id)!
      return { ...c, score: s.score, covered: s.covered, total: s.total }
    }),
    claims,
  }
}

/** Cells a careful reader should still check before relying on them. */
export function openItems(claims: SnapshotClaim[]): SnapshotClaim[] {
  return claims.filter((c) => c.flagged || (c.verification === 'unverified' && c.origin !== 'user'))
}

const BRIEF_SYSTEM = `You write a short decision brief for a small team, in Markdown.

Rules:
- Use ONLY the facts in the JSON table you are given. No outside knowledge.
- The team has already chosen an option. Explain the choice; do not argue against it. If another option scored higher, say so plainly in Trade-offs.
- Cite every factual statement with the number of the table cell it comes from, in square brackets, e.g. "Standard costs $90/month for 3 agents [2]." Several: [2][5].
- Cells with "status": "needs checking" or "flagged": true are NOT established facts. Do not state them as fact; list them under "Still to verify".
- Cells with "origin": "user" were corrected by the team; treat them as the team's own findings.
- Exactly these sections, in this order:
## Decision
(1-2 sentences: the chosen option and its plan)
## Why
(3-5 bullet points)
## Trade-offs
(2-4 bullet points, including what the other options do better)
## Still to verify
(bullet points, or a single bullet "- Nothing outstanding.")
- Under 250 words. Only headings, bullets, plain sentences and **bold**. No links, tables, images or HTML.`

export function briefMessages(p: Omit<SnapshotPayload, 'briefSource'>) {
  const name = (id: string) => p.candidates.find((c) => c.id === id)?.name ?? id
  const crit = (id: string) => p.criteria.find((k) => k.id === id)?.name ?? id
  const table = {
    question: p.question,
    context: p.context,
    chosen: name(p.chosenCandidateId),
    options: p.candidates.map((c) => ({ name: c.name, plan: c.planBasis || null, weightedScore: c.score })),
    criteria: p.criteria.map((k) => ({ name: k.name, weight: k.weight })),
    cells: p.claims.map((c) => ({
      n: c.n,
      option: name(c.candidateId),
      criterion: crit(c.criterionId),
      value: c.value || 'Not found',
      score: c.score || null,
      status: c.verification === 'unverified' ? 'needs checking' : c.verification === 'not_found' ? 'not found' : 'quote verified',
      origin: c.origin,
      flagged: c.flagged,
    })),
  }
  return [
    { role: 'system' as const, content: BRIEF_SYSTEM },
    { role: 'user' as const, content: JSON.stringify(table) },
  ]
}

/** Keeps only the Markdown the renderer supports and drops citations to cells that don't exist. */
export function sanitizeBrief(markdown: string, claimCount: number): string {
  return markdown
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/!?\[([^\]]+)\]\((?:[^)]*)\)/g, '$1') // markdown links/images → their text
    .replace(/\[(\d{1,3})\]/g, (m, d) => (Number(d) >= 1 && Number(d) <= claimCount ? m : ''))
    .trim()
    .slice(0, 4000)
}

/** Used when the AI call fails: a plain brief built straight from the data. */
export function templateBrief(p: Omit<SnapshotPayload, 'briefSource'>): string {
  const chosen = p.candidates.find((c) => c.id === p.chosenCandidateId)
  const ranked = rankCandidates(p.candidates.map((c) => ({ candidateId: c.id, score: c.score, covered: c.covered, total: c.total })))
  const nameOf = (id: string) => p.candidates.find((c) => c.id === id)?.name ?? ''
  const cite = (c: SnapshotClaim) => `[${c.n}]`
  const chosenClaims = p.claims.filter((c) => c.candidateId === p.chosenCandidateId && c.value && !c.flagged)
  const open = openItems(p.claims)
  const lines = [
    '## Decision',
    `The team chose **${chosen?.name ?? 'an option'}**${chosen?.planBasis ? ` (${chosen.planBasis} plan)` : ''}.`,
    '## Why',
    ...(chosenClaims.length
      ? chosenClaims.slice(0, 5).map((c) => `- ${p.criteria.find((k) => k.id === c.criterionId)?.name}: ${c.value} ${cite(c)}`)
      : ['- No researched facts were recorded for this option.']),
    '## Trade-offs',
    ...ranked
      .filter((r) => r.score !== null)
      .map((r) => `- ${nameOf(r.candidateId)}: weighted score ${r.score} (${r.covered} of ${r.total} criteria scored)`),
    '## Still to verify',
    ...(open.length
      ? open.map((c) => `- ${nameOf(c.candidateId)} · ${p.criteria.find((k) => k.id === c.criterionId)?.name} ${cite(c)}`)
      : ['- Nothing outstanding.']),
  ]
  return lines.join('\n')
}

export type Inline = { kind: 'text'; text: string } | { kind: 'bold'; text: string } | { kind: 'cite'; n: number }
export type Block = { kind: 'heading' | 'paragraph' | 'bullet'; inline: Inline[] }

function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  const re = /\*\*([^*]+)\*\*|\[(\d{1,3})\]/g
  let last = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ kind: 'bold', text: m[1] })
    else out.push({ kind: 'cite', n: Number(m[2]) })
    last = re.lastIndex
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}

/** Splits the (sanitized) brief into headings, paragraphs and bullets for rendering. */
export function parseBrief(markdown: string): Block[] {
  const blocks: Block[] = []
  for (const raw of markdown.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const heading = /^#{1,4}\s+(.*)$/.exec(line)
    const bullet = /^[-*•]\s+(.*)$/.exec(line)
    if (heading) blocks.push({ kind: 'heading', inline: parseInline(heading[1]) })
    else if (bullet) blocks.push({ kind: 'bullet', inline: parseInline(bullet[1]) })
    else blocks.push({ kind: 'paragraph', inline: parseInline(line) })
  }
  return blocks
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** HTML for email. Everything is escaped; citations link to the cell's source when there is one. */
export function briefToHtml(blocks: Block[], claims: SnapshotClaim[]): string {
  const inline = (parts: Inline[]) =>
    parts
      .map((p) => {
        if (p.kind === 'text') return esc(p.text)
        if (p.kind === 'bold') return `<strong>${esc(p.text)}</strong>`
        const url = claims.find((c) => c.n === p.n)?.source?.url
        return url && /^https?:\/\//.test(url)
          ? `<a href="${esc(url)}" style="color:#6366f1">[${p.n}]</a>`
          : `[${p.n}]`
      })
      .join('')
  const html: string[] = []
  let inList = false
  for (const b of blocks) {
    if (b.kind === 'bullet' && !inList) {
      html.push('<ul>')
      inList = true
    }
    if (b.kind !== 'bullet' && inList) {
      html.push('</ul>')
      inList = false
    }
    if (b.kind === 'heading') html.push(`<h3 style="margin:16px 0 4px">${inline(b.inline)}</h3>`)
    else if (b.kind === 'bullet') html.push(`<li>${inline(b.inline)}</li>`)
    else html.push(`<p>${inline(b.inline)}</p>`)
  }
  if (inList) html.push('</ul>')
  return html.join('\n')
}

/** Plain-text version for email clients that don't show HTML. */
export function briefToText(blocks: Block[]): string {
  const inline = (parts: Inline[]) => parts.map((p) => (p.kind === 'cite' ? `[${p.n}]` : p.text)).join('')
  return blocks
    .map((b) => (b.kind === 'heading' ? `\n${inline(b.inline).toUpperCase()}` : b.kind === 'bullet' ? `- ${inline(b.inline)}` : inline(b.inline)))
    .join('\n')
    .trim()
}

/** Snapshot payloads are stored in a JSON column; accept either a parsed object or its string form. */
export function readPayload(value: unknown): SnapshotPayload | null {
  try {
    const v = typeof value === 'string' ? JSON.parse(value) : value
    return v && typeof v === 'object' && (v as SnapshotPayload).format === 1 ? (v as SnapshotPayload) : null
  } catch {
    return null
  }
}
