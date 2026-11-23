/**
 * Turns a research job's raw error into one sentence a user can act on.
 *
 * The raw message (shown only in the server log) comes from three places:
 *   - the SDK: "Integration call <endpoint> failed: <detail>" and
 *     "RecordRoom tool <tool> failed: <detail>"
 *   - our own pipeline (run-candidate.ts, extract.ts)
 *   - the runtime (timeouts, cancellation)
 * Order matters: the first matching rule wins, most specific first.
 */

const RULES: { test: RegExp; message: string }[] = [
  { test: /no longer exists/i, message: 'This option was removed from the decision.' },
  { test: /\bcancel/i, message: 'Research for this option was cancelled.' },
  {
    test: /credit|insufficient|quota|payment required|\b402\b/i,
    message: 'The app has run out of research credits. Please let the app owner know.',
  },
  {
    test: /rate.?limit|too many requests|\b429\b/i,
    message: 'The research services are busy right now. Wait a minute, then retry.',
  },
  { test: /timed? ?out|timeout|deadline|abort/i, message: 'Research took too long. Retry; it usually succeeds the second time.' },
  {
    test: /no JSON|not valid JSON|wrong shape|returned no content/i,
    message: 'The AI’s answer couldn’t be read. Retry; this usually fixes itself.',
  },
  {
    test: /Integration call exa\//i,
    message: 'Web search failed for this option. Retry, or add the official website to help the search.',
  },
  { test: /Integration call openai\//i, message: 'The AI service didn’t respond. Wait a minute, then retry.' },
  { test: /RecordRoom tool/i, message: 'Results couldn’t be saved. Retry; nothing you entered was lost.' },
]

export const FALLBACK_RESEARCH_ERROR = 'Something went wrong while researching this option. Retry, or try again later.'

export function friendlyResearchError(raw: unknown): string {
  const text = raw instanceof Error ? raw.message : String(raw ?? '')
  return RULES.find((r) => r.test.test(text))?.message ?? FALLBACK_RESEARCH_ERROR
}
