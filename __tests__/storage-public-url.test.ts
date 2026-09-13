jest.mock('server-only', () => ({}), { virtual: true })
import { publicStorageUrl } from '@/lib/storage-public-url'

const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://217.154.228.254/supabase', SUPABASE_INTERNAL_URL: 'http://127.0.0.1:9080' }

describe('self-hosted browser Storage URLs', () => {
  it('maps cached public audio to the HTTPS API prefix', () => {
    expect(publicStorageUrl('http://127.0.0.1:9080/storage/v1/object/public/audio_cache/de/hash.mp3', env))
      .toBe('https://217.154.228.254/supabase/storage/v1/object/public/audio_cache/de/hash.mp3')
  })
  it('preserves encoded object names and signed query bytes without normalization', () => {
    const suffix = '/storage/v1/object/sign/pronunciation_audio/u/%D0%BF%20%2F%25%2b.webm?token=a%2Bb%2fc%3D&download=T%C3%BCr+1.webm&x=%252F'
    expect(publicStorageUrl(env.SUPABASE_INTERNAL_URL + suffix, env)).toBe(env.NEXT_PUBLIC_SUPABASE_URL + suffix)
  })
  it('replaces an internal API path prefix exactly once and accepts trailing config slashes', () => {
    expect(publicStorageUrl('http://127.0.0.1:9080/private-api/storage/v1/object/sign/b/x?token=z', {
      NEXT_PUBLIC_SUPABASE_URL: 'https://217.154.228.254/supabase/', SUPABASE_INTERNAL_URL: 'http://127.0.0.1:9080/private-api/',
    })).toBe('https://217.154.228.254/supabase/storage/v1/object/sign/b/x?token=z')
  })
  it('works when the server already uses the public configured API', () => {
    const value = 'https://217.154.228.254/supabase/storage/v1/object/public/b/x'
    expect(publicStorageUrl(value, { NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL })).toBe(value)
  })
  it.each([
    'http://127.0.0.1:9081/storage/v1/object/sign/b/x',
    'http://127.0.0.1.evil.example:9080/storage/v1/object/sign/b/x',
    'http://127.0.0.1:9080@evil.example/storage/v1/object/sign/b/x',
    'http://user:password@127.0.0.1:9080/storage/v1/object/sign/b/x',
    'https://external.example/storage/v1/object/sign/b/x',
    'http://127.0.0.1:9080/auth/v1/callback',
    'http://127.0.0.1:9080/storage/v1/object/../../auth/v1/callback',
    'http://127.0.0.1:9080/storage/v1/object/sign/b/x#fragment',
    '//127.0.0.1:9080/storage/v1/object/sign/b/x',
  ])('rejects unrelated or invalid backend URL %s', value => {
    expect(() => publicStorageUrl(value, env)).toThrow()
  })
  it('rejects lookalike internal API path prefixes', () => {
    expect(() => publicStorageUrl('http://127.0.0.1:9080/api-other/storage/v1/object/sign/b/x', { ...env, SUPABASE_INTERNAL_URL: 'http://127.0.0.1:9080/api' })).toThrow()
  })
  it('fails closed for missing public configuration or a retired Cloud endpoint', () => {
    expect(() => publicStorageUrl('http://127.0.0.1:9080/storage/v1/object/sign/b/x', { SUPABASE_INTERNAL_URL: env.SUPABASE_INTERNAL_URL })).toThrow()
    expect(() => publicStorageUrl('https://retired.supabase.co/storage/v1/object/sign/b/x', { NEXT_PUBLIC_SUPABASE_URL: 'https://retired.supabase.co' })).toThrow()
  })
})
