/** Public browser configuration and optional private server API address. */
export interface SupabasePublicEnv {
  NEXT_PUBLIC_SUPABASE_URL?: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  SUPABASE_INTERNAL_URL?: string
}
export interface SupabasePublicConfig { url: string; anonKey: string }
export const SUPABASE_COOKIE_NAME = 'sb-sitov-auth-token'

function apiUrl(value: string | undefined): string {
  if (!value?.trim()) return ''
  const url = new URL(value.trim())
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Invalid Supabase API address')
  }
  const hostname = url.hostname.replace(/\.$/, '')
  if (hostname === 'supabase.co' || hostname.endsWith('.supabase.co')) {
    throw new Error('This deployment requires the self-hosted Supabase API')
  }
  return url.toString().replace(/\/$/, '')
}

export function readSupabasePublicConfig(env: SupabasePublicEnv = process.env as SupabasePublicEnv): SupabasePublicConfig {
  return {
    url: apiUrl(env.NEXT_PUBLIC_SUPABASE_URL?.trim() || env.SUPABASE_URL),
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || env.SUPABASE_ANON_KEY?.trim() || '',
  }
}

export function readSupabaseServerConfig(env: SupabasePublicEnv = process.env as SupabasePublicEnv): SupabasePublicConfig {
  const config = readSupabasePublicConfig(env)
  const url = apiUrl(env.SUPABASE_INTERNAL_URL) || config.url
  if (!url || !config.anonKey) throw new Error('Self-hosted Supabase configuration is incomplete')
  return { ...config, url }
}
