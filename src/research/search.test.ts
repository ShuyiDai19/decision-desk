import { describe, expect, it } from 'vitest'
import { pickOfficialDomain, planQueries, siteDomain } from './search'

describe('siteDomain', () => {
  it('reduces subdomains to the site', () => {
    expect(siteDomain('https://help.zendesk.com/hc/en-us')).toBe('zendesk.com')
    expect(siteDomain('https://www.freshworks.com/freshdesk/')).toBe('freshworks.com')
    expect(siteDomain('not a url')).toBe('')
  })
})

describe('pickOfficialDomain', () => {
  it('picks the result whose domain contains the product name', () => {
    const urls = ['https://www.g2.com/products/help-scout', 'https://www.helpscout.com/pricing/']
    expect(pickOfficialDomain('Help Scout', urls)).toBe('helpscout.com')
  })

  it('returns empty when nothing matches, rather than guessing', () => {
    expect(pickOfficialDomain('Help Scout', ['https://www.g2.com/x', 'https://capterra.com/y'])).toBe('')
  })
})

describe('planQueries', () => {
  it('scopes both queries to the domain when known', () => {
    const q = planQueries('Zendesk', ['Price', 'Knowledge base'], 'zendesk.com')
    expect(q).toEqual([
      { query: 'Zendesk pricing plans', includeDomains: ['zendesk.com'] },
      { query: 'Zendesk Price, Knowledge base', includeDomains: ['zendesk.com'] },
    ])
  })

  it('omits the filter when no domain is known', () => {
    expect(planQueries('X', ['Price'], '')[0]).toEqual({ query: 'X pricing plans' })
  })
})
