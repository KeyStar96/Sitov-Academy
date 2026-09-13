import { normalizeOrigin, originFromHeaders, resolveSiteUrl, resolveOutboundSiteUrl, resolveAuthRedirectOrigin, buildSiteUrl, isLocalhostOrigin } from '@/lib/site-url'

const production = { NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://217.154.228.254' }
describe('self-hosted origins', () => {
  it('normalizes valid HTTP origins without retaining paths', () => {
    expect(normalizeOrigin(' https://217.154.228.254/de/ ')).toBe('https://217.154.228.254')
    expect(normalizeOrigin('localhost:3000')).toBeNull()
    expect(normalizeOrigin('http://localhost:3000/')).toBe('http://localhost:3000')
    expect(normalizeOrigin('site.example')).toBe('https://site.example')
  })
  it.each(['', 'ftp://host.test', 'javascript:alert(1)', 'https://user:password@host.test'])('rejects unsafe origin %s', value => {
    expect(normalizeOrigin(value)).toBeNull()
  })
  it('reads only the first proxy host for development diagnostics', () => {
    expect(originFromHeaders('site.example, proxy.example', 'https, http', 'internal')).toBe('https://site.example')
    expect(originFromHeaders(null, null, 'localhost:3000')).toBe('http://localhost:3000')
    expect(originFromHeaders(null, null, null)).toBeNull()
  })
  it('uses the explicitly configured VPS for production redirects and mail', () => {
    expect(resolveSiteUrl(production, 'https://attacker.example')).toBe(production.NEXT_PUBLIC_SITE_URL)
    expect(resolveOutboundSiteUrl(production, 'https://attacker.example')).toBe(production.NEXT_PUBLIC_SITE_URL)
    expect(resolveAuthRedirectOrigin(production, 'http://localhost:3000')).toBe(production.NEXT_PUBLIC_SITE_URL)
  })
  it('fails closed when production origin is absent, regardless of request headers', () => {
    expect(() => resolveSiteUrl({ NODE_ENV:'production' }, 'https://attacker.example')).toThrow()
    expect(() => resolveOutboundSiteUrl({ NODE_ENV:'production' }, 'https://attacker.example')).toThrow()
  })
  it('supports an explicit private SITE_URL alias', () => {
    expect(resolveOutboundSiteUrl({ SITE_URL:production.NEXT_PUBLIC_SITE_URL })).toBe(production.NEXT_PUBLIC_SITE_URL)
  })
  it('keeps development on loopback and never derives outbound mail URLs from headers', () => {
    expect(resolveSiteUrl({})).toBe('http://localhost:3000')
    expect(resolveOutboundSiteUrl({}, 'https://attacker.example')).toBe('http://localhost:3000')
    expect(resolveAuthRedirectOrigin({}, 'http://localhost:3002')).toBe('http://localhost:3002')
    expect(isLocalhostOrigin('http://[::1]:3000')).toBe(true)
  })
  it('encodes redirect parameters', () => {
    const result = new URL(buildSiteUrl(production.NEXT_PUBLIC_SITE_URL, '/auth/confirm', { next:'/ru/dashboard?lesson=1', token_hash:'a+b' }))
    expect(result.origin).toBe(production.NEXT_PUBLIC_SITE_URL)
    expect(result.searchParams.get('next')).toBe('/ru/dashboard?lesson=1')
    expect(result.searchParams.get('token_hash')).toBe('a+b')
  })
  it.each(['//attacker.example/path', '/\n/attacker.example/path', '/\\attacker.example/path'])('refuses paths normalized to an external origin: %j', path => {
    expect(() => buildSiteUrl(production.NEXT_PUBLIC_SITE_URL, path)).toThrow('configured origin')
  })
})
