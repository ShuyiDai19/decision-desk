/**
 * Quote verification: the deterministic check behind the "verified" badge.
 *
 * The model is asked to copy a short quote verbatim from a page. Here, in
 * code, we confirm the quote really occurs in that page's text. If it does
 * not (the model paraphrased, misremembered, or made it up), the claim is
 * shown as "needs checking" instead of "verified".
 *
 * Normalisation only removes differences that do not change meaning:
 * letter case, whitespace, curly vs straight quotes, dash variants,
 * non-breaking and zero-width characters.
 */

/** Quotes shorter than this are too generic to prove anything ("Yes", "Free"). */
export const MIN_QUOTE_LENGTH = 15

export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[​-‍﻿]/g, '') // zero-width characters
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Leading list bullets and trailing sentence punctuation are dropped from the
 * quote only: models often add a final period or drop a bullet, and neither
 * changes what the quote says. Punctuation inside the quote still has to match.
 */
function trimQuoteEdges(normalizedQuote: string): string {
  return normalizedQuote.replace(/^[-*\u2022\s]+/, '').replace(/[\s.,;:!?]+$/, '')
}

/** True when `quote` occurs in `pageText` after normalisation and is long enough to mean something. */
export function quoteAppearsIn(quote: string, pageText: string): boolean {
  const q = trimQuoteEdges(normalizeForMatch(quote))
  if (q.length < MIN_QUOTE_LENGTH) return false
  return normalizeForMatch(pageText).includes(q)
}
