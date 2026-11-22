/**
 * Search planning: which domain counts as "official" and which Exa queries
 * to run. Pure functions; the job does the calls.
 */

/** Hostname without a leading "www.", or '' for an invalid URL. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * Site domain used for Exa's includeDomains. Keeps the last two labels
 * (help.zendesk.com → zendesk.com) so help centres and pricing pages on
 * subdomains are included.
 *
 * Known limitation: wrong for two-part public suffixes such as .co.uk.
 */
export function siteDomain(url: string): string {
  const host = hostnameOf(url)
  const labels = host.split('.').filter(Boolean)
  return labels.length <= 2 ? host : labels.slice(-2).join('.')
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * When the user gave no website, pick the first search result whose domain
 * contains the product name ("Help Scout" → helpscout.com). Returns '' when
 * none matches; the job then searches without a domain filter and the
 * sources table shows which sites were used.
 */
export function pickOfficialDomain(productName: string, resultUrls: string[]): string {
  const name = slug(productName)
  if (!name) return ''
  for (const url of resultUrls) {
    const domain = siteDomain(url)
    if (domain && slug(domain.split('.')[0]).includes(name)) return domain
  }
  return ''
}

export type SearchQuery = { query: string; includeDomains?: string[] }

/** Two queries: one aimed at pricing, one at the decision's criteria. */
export function planQueries(productName: string, criteriaNames: string[], domain: string): SearchQuery[] {
  const scope = domain ? { includeDomains: [domain] } : {}
  return [
    { query: `${productName} pricing plans`, ...scope },
    { query: `${productName} ${criteriaNames.join(', ')}`.slice(0, 300), ...scope },
  ]
}
