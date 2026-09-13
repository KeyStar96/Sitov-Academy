import { readSupabasePublicConfig, readSupabaseServerConfig } from '@/lib/supabase-env'

describe('readSupabasePublicConfig', () => {
  it('bevorzugt die NEXT_PUBLIC_-Namen', () => {
    expect(
      readSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: 'https://217.154.228.254/supabase',
        SUPABASE_URL: 'https://alias.example',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-public',
        SUPABASE_ANON_KEY: 'anon-alias',
      })
    ).toEqual({
      url: 'https://217.154.228.254/supabase',
      anonKey: 'anon-public',
    })
  })

  it('nimmt die Aliase SUPABASE_URL und SUPABASE_ANON_KEY, wenn die öffentlichen Namen fehlen', () => {
    expect(
      readSupabasePublicConfig({
        SUPABASE_URL: 'https://217.154.228.254/supabase',
        SUPABASE_ANON_KEY: 'anon-alias',
      })
    ).toEqual({
      url: 'https://217.154.228.254/supabase',
      anonKey: 'anon-alias',
    })
  })

  it('gibt leere Strings zurück, wenn nichts gesetzt ist', () => {
    expect(readSupabasePublicConfig({})).toEqual({ url: '', anonKey: '' })
  })
})

 it('rejects Cloud endpoints and prefers the internal server endpoint', () => {
   expect(() => readSupabasePublicConfig({ SUPABASE_URL:'https://old.supabase.co' })).toThrow('self-hosted')
   expect(readSupabaseServerConfig({ NEXT_PUBLIC_SUPABASE_URL:'https://217.154.228.254/supabase', NEXT_PUBLIC_SUPABASE_ANON_KEY:'local', SUPABASE_INTERNAL_URL:'http://127.0.0.1:9080/' }).url).toBe('http://127.0.0.1:9080')
 })

it.each(['https://old.supabase.co.', 'https://supabase.co', 'ftp://localhost:8000', 'https://user:password@school.test'])('rejects a bypassed or unsafe API origin %s', url => {
  expect(() => readSupabasePublicConfig({ SUPABASE_URL: url })).toThrow()
})
