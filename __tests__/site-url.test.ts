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
  it.each([undefined, '', '   ', 'javascript:alert(1)', 'https://user:password@host.test'])('fails closed when production origin is absent or unsafe: %j', value => {
    const env = { NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: value, SITE_URL: value }
    expect(() => resolveSiteUrl(env, 'https://attacker.example')).toThrow()
    expect(() => resolveOutboundSiteUrl(env, 'https://attacker.example')).toThrow()
    expect(() => resolveAuthRedirectOrigin(env, 'http://localhost:3002')).toThrow()
  })
  it.each(['production', 'development'])('prefers NEXT_PUBLIC_SITE_URL over SITE_URL in %s', NODE_ENV => {
    const env = { NODE_ENV, NEXT_PUBLIC_SITE_URL: ' https://public.example/de/ ', SITE_URL: 'https://private.example' }
    expect(resolveSiteUrl(env)).toBe('https://public.example')
    expect(resolveOutboundSiteUrl(env)).toBe('https://public.example')
    expect(resolveAuthRedirectOrigin(env, 'https://attacker.example')).toBe('https://public.example')
  })
  it.each([undefined, '', '   ', 'ftp://invalid.example'])('uses SITE_URL when the public origin is unavailable: %j', NEXT_PUBLIC_SITE_URL => {
    const env = { NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL, SITE_URL: ' https://private.example/de/ ' }
    expect(resolveSiteUrl(env)).toBe('https://private.example')
    expect(resolveOutboundSiteUrl(env)).toBe('https://private.example')
    expect(resolveAuthRedirectOrigin(env, 'http://localhost:3002')).toBe('https://private.example')
  })
  it('keeps development on loopback and never derives outbound mail URLs from headers', () => {
    expect(resolveSiteUrl({})).toBe('http://localhost:3000')
    expect(resolveSiteUrl({}, 'https://attacker.example')).toBe('http://localhost:3000')
    expect(resolveSiteUrl({}, 'http://localhost:3002')).toBe('http://localhost:3000')
    expect(resolveOutboundSiteUrl({}, 'https://attacker.example')).toBe('http://localhost:3000')
    expect(resolveAuthRedirectOrigin({}, 'https://attacker.example')).toBe('http://localhost:3000')
    expect(isLocalhostOrigin('http://[::1]:3000')).toBe(true)
  })
  it.each(['http://localhost:3002', 'http://127.0.0.1:3002', 'http://[::1]:3002'])('preserves the local auth callback origin outside production: %s', origin => {
    const env = { NODE_ENV: 'development', NEXT_PUBLIC_SITE_URL: production.NEXT_PUBLIC_SITE_URL }
    expect(resolveAuthRedirectOrigin(env, origin)).toBe(origin)
  })
  it.each(['https://localhost.attacker.example', 'https://127.0.0.1.attacker.example'])('rejects a lookalike localhost origin for auth redirects: %s', origin => {
    expect(isLocalhostOrigin(origin)).toBe(false)
    expect(resolveAuthRedirectOrigin({}, origin)).toBe('http://localhost:3000')
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

describe('canonical deployment origin', () => {
  function readCanonicalOrigin(env: NodeJS.ProcessEnv): string {
    const originalEnv = process.env
    process.env = { ...env }
    try {
      let origin = ''
      jest.isolateModules(() => {
        origin = (require('@/lib/site-url') as typeof import('@/lib/site-url')).CANONICAL_SITE_URL
      })
      return origin
    } finally {
      process.env = originalEnv
    }
  }

  it('uses the same normalized public/private precedence as runtime links', () => {
    expect(readCanonicalOrigin({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: ' https://public.example/de/ ', SITE_URL: 'https://private.example' })).toBe('https://public.example')
    expect(readCanonicalOrigin({ NODE_ENV: 'production', SITE_URL: ' https://private.example/de/ ' })).toBe('https://private.example')
  })
  it('allows the development fallback but fails closed without a production origin', () => {
    expect(readCanonicalOrigin({ NODE_ENV: 'development' })).toBe('http://localhost:3000')
    expect(() => readCanonicalOrigin({ NODE_ENV: 'production' })).toThrow()
  })
})
