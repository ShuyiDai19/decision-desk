/**
 * Finalizing, sharing and emailing a decision.
 *
 *   finalizeDecision       freeze the reviewed table into a snapshot + brief
 *   setSnapshotVisibility  turn the read-only share link on or off
 *   emailSnapshot          email the brief (makes the link public so it works)
 *
 * Actions run with record RBAC off, so each one loads the record and checks
 * ownerId against the caller before doing anything.
 */

import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  briefMessages,
  briefToHtml,
  briefToText,
  buildSnapshotPayload,
  parseBrief,
  readPayload,
  sanitizeBrief,
  templateBrief,
  type SnapshotPayload,
} from '../lib/brief'
import { parseRecipients } from '../lib/recipients'
import { RESEARCH_MODEL } from '../research/extract'
import type { Decision } from '../schemas/decisions-schema'
import type { Criterion } from '../schemas/criteria-schema'
import type { Candidate } from '../schemas/candidates-schema'
import type { Claim } from '../schemas/claims-schema'
import type { Source } from '../schemas/sources-schema'
import type { Snapshot } from '../schemas/snapshots-schema'

const fail = (error: string, code: string) => ({ success: false as const, error, code })

/**
 * Base URL for links in emails. The page sends its own origin so that emails
 * sent while testing locally link back to the local app; only the deployed
 * app's origin or a localhost origin is accepted, anything else falls back to
 * the deployed app, so a caller can't point the email at another site.
 */
export function linkOrigin(requested: unknown, appName: string): string {
  const deployed = `https://${appName}.app.space`
  if (typeof requested !== 'string') return deployed
  try {
    const u = new URL(requested)
    if (u.origin === deployed) return deployed
    if ((u.hostname === 'localhost' || u.hostname === '127.0.0.1') && (u.protocol === 'http:' || u.protocol === 'https:')) {
      return u.origin
    }
  } catch {
    // not a URL
  }
  return deployed
}
const str = (v: unknown) => (typeof v === 'string' ? v : '')

async function all<T extends Record<string, unknown>>(tools: ActionTools, collection: string, decisionId: string) {
  const r = await tools.query<T>(collection, { where: { decisionId }, limit: 200 })
  return r.success ? r.data.records : []
}

async function ownedSnapshot(tools: ActionTools, userId: string, snapshotId: string) {
  const got = await tools.get<Snapshot>('snapshots', snapshotId)
  return got.success && got.data.record.data.ownerId === userId ? got.data.record : null
}

export const finalizeDecision: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const decisionId = str(params.decisionId)
  const chosenCandidateId = str(params.chosenCandidateId)

  const got = await tools.get<Decision>('decisions', decisionId)
  if (!decisionId || !got.success || got.data.record.data.ownerId !== userId) return fail('Decision not found.', 'not_found')
  const decision = got.data.record.data

  const candidates = await all<Candidate>(tools, 'candidates', decisionId)
  if (!candidates.some((c) => c.recordId === chosenCandidateId)) return fail('Choose one of the options.', 'invalid_input')
  if (candidates.some((c) => ['queued', 'searching', 'extracting'].includes(c.data.researchStatus))) {
    return fail('Wait for research to finish before deciding.', 'research_running')
  }
  const [criteria, claims, sources, snapshots] = await Promise.all([
    all<Criterion>(tools, 'criteria', decisionId),
    all<Claim>(tools, 'claims', decisionId),
    all<Source>(tools, 'sources', decisionId),
    all<Snapshot>(tools, 'snapshots', decisionId),
  ])
  if (claims.length === 0) return fail('Run research before deciding.', 'no_research')

  const base = buildSnapshotPayload({
    question: decision.question,
    context: decision.context,
    chosenCandidateId,
    finalizedAt: new Date().toISOString(),
    criteria: criteria.map((k) => ({ id: k.recordId, ...k.data })),
    candidates: candidates.map((c) => ({
      id: c.recordId,
      name: c.data.name,
      homepageUrl: c.data.homepageUrl,
      planBasis: c.data.planBasis ?? '',
    })),
    claims: claims.map((c) => ({ ...c.data })),
    sources: sources.map((s) => ({ id: s.recordId, url: s.data.url, title: s.data.title, fetchedAt: s.data.fetchedAt })),
  })

  // The brief is a nice-to-have: if the model fails, fall back to a template rather than blocking the decision.
  let brief = ''
  let briefSource: SnapshotPayload['briefSource'] = 'ai'
  const ai = await tools.integration<{ choices?: { message?: { content?: string } }[] }>('openai/chat-completion', {
    model: RESEARCH_MODEL,
    max_tokens: 1200,
    messages: briefMessages(base),
  })
  if (ai.success) brief = sanitizeBrief(ai.data.choices?.[0]?.message?.content ?? '', base.claims.length)
  if (!brief.includes('## Decision')) {
    brief = templateBrief(base)
    briefSource = 'template'
  }

  const version = Math.max(0, ...snapshots.map((s) => s.data.version)) + 1
  const payload: SnapshotPayload = { ...base, briefSource }
  const created = await tools.create('snapshots', {
    decisionId,
    version,
    chosenCandidateId,
    payload: JSON.stringify(payload),
    briefMarkdown: brief,
    visibility: 'private',
    emailedAt: '',
  })
  if (!created.success) return created
  await tools.update('decisions', decisionId, { status: 'decided', chosenCandidateId })

  return { success: true, data: { snapshotId: created.data.recordId, version, briefSource } }
}

export const setSnapshotVisibility: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const visibility = str(params.visibility)
  if (visibility !== 'public' && visibility !== 'private') return fail('Invalid visibility.', 'invalid_input')
  const snap = await ownedSnapshot(tools, userId, str(params.snapshotId))
  if (!snap) return fail('Snapshot not found.', 'not_found')
  const r = await tools.update('snapshots', snap.recordId, { visibility })
  return r.success ? { success: true, data: { visibility } } : r
}

export const emailSnapshot: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const parsed = parseRecipients(params.recipients)
  if (!parsed.ok) return fail(parsed.error, 'invalid_input')
  const snap = await ownedSnapshot(tools, userId, str(params.snapshotId))
  if (!snap) return fail('Snapshot not found.', 'not_found')
  if (snap.data.emailedAt) return fail('This version was already emailed. Finalize again to send an updated version.', 'already_sent')
  const payload = readPayload(snap.data.payload)
  if (!payload) return fail('This snapshot could not be read.', 'invalid_state')

  // The email links to the snapshot, so the link has to work for the recipients.
  if (snap.data.visibility !== 'public') {
    const r = await tools.update('snapshots', snap.recordId, { visibility: 'public' })
    if (!r.success) return r
  }

  const me = await tools.get<{ email?: string; name?: string }>('users', userId)
  const replyTo = me.success ? me.data.record.data.email : undefined
  const from = me.success ? me.data.record.data.name || replyTo : undefined
  const link = `${linkOrigin(params.origin, env.APP_NAME)}/s/${snap.recordId}`
  const chosen = payload.candidates.find((c) => c.id === payload.chosenCandidateId)?.name ?? 'a decision'
  const blocks = parseBrief(snap.data.briefMarkdown)
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const html = `<div style="font-family:system-ui,sans-serif;max-width:600px;line-height:1.5;color:#111">
<p style="color:#555">${esc(from ?? 'A teammate')} shared a decision from Decision Desk.</p>
<h2 style="margin:8px 0">${esc(payload.question)}</h2>
${briefToHtml(blocks, payload.claims)}
<p style="margin-top:24px"><a href="${esc(link)}" style="color:#6366f1">See the full comparison with every source, and say whether you agree →</a></p>
</div>`
  const text = `${from ?? 'A teammate'} shared a decision from Decision Desk.\n\n${payload.question}\n\n${briefToText(blocks)}\n\nFull comparison with sources, and a place to say whether you agree: ${link}`

  const sent = await tools.integration('email/send', {
    to: parsed.emails,
    subject: `Decision: ${chosen} — ${payload.question}`.slice(0, 180),
    html,
    text,
    ...(replyTo ? { reply_to: replyTo } : {}),
  })
  if (!sent.success) return fail('The email could not be sent. Try again in a minute.', 'email_failed')

  await tools.update('snapshots', snap.recordId, { emailedAt: new Date().toISOString() })
  return { success: true, data: { sent: parsed.emails.length, link } }
}
