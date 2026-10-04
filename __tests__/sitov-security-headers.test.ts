import { sitovSecurityHeaders } from '@/lib/sitov-security-headers'

function policies(env = {}) {
  const headers = Object.fromEntries(sitovSecurityHeaders(env).map(header => [header.key, header.value]))
  return { enforced: headers['Content-Security-Policy'], headers }
}

it('enforces external script, object, framing and form restrictions while preserving Next hydration', () => {
  const { enforced, headers } = policies()
  expect(enforced).toContain("script-src 'self' 'unsafe-inline';")
  expect(enforced).not.toContain('facebook')
  expect(enforced).not.toContain('unsafe-eval')
  for (const directive of ["object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'"]) {
    expect(enforced).toContain(directive)
  }
  expect(headers['X-Content-Type-Options']).toBe('nosniff')
})

it('allows the configured public Storage and Realtime origins without including paths or private servers', () => {
  const { enforced } = policies({ NEXT_PUBLIC_SUPABASE_URL: 'https://school.test/supabase' })
  expect(enforced).toContain("connect-src 'self' https://school.test wss://school.test")
  expect(enforced).toContain("media-src 'self' blob: data: https://school.test")
  expect(enforced).toContain("frame-src 'self' blob: https://school.test")
  expect(enforced).not.toContain('/supabase')
  expect(enforced).not.toContain('127.0.0.1')
})

it.each(['javascript:alert(1)', 'https://name:secret@school.test', 'https://school.test/?script-src=evil', 'not a URL'])(
  'refuses an invalid public origin before generating headers: %s', url => {
    expect(() => policies({ NEXT_PUBLIC_SUPABASE_URL: url })).toThrow()
  },
)
