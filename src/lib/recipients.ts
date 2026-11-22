/** Who a decision brief may be emailed to: the author plus up to 3 teammates. */

export const MAX_RECIPIENTS = 4

const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i

/** Accepts an array or a comma/space/newline-separated string; trims, lowercases, de-duplicates. */
export function parseRecipients(input: unknown): { ok: true; emails: string[] } | { ok: false; error: string } {
  const parts = (Array.isArray(input) ? input : typeof input === 'string' ? input.split(/[\s,;]+/) : [])
    .map((x) => (typeof x === 'string' ? x.trim().toLowerCase() : ''))
    .filter(Boolean)
  const emails = [...new Set(parts)]
  if (emails.length === 0) return { ok: false, error: 'Add at least one email address.' }
  if (emails.length > MAX_RECIPIENTS) return { ok: false, error: `Send to at most ${MAX_RECIPIENTS} people.` }
  const bad = emails.find((e) => !EMAIL.test(e) || e.length > 254)
  if (bad) return { ok: false, error: `"${bad}" doesn't look like an email address.` }
  return { ok: true, emails }
}
