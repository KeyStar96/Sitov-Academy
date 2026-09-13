import 'server-only'

import { readSupabasePublicConfig, type SupabasePublicEnv } from '@/lib/supabase-env'

/** Translate only URLs emitted by this deployment's configured Storage API.
 * Keep the encoded object path and signed query bytes intact; never parse them
 * as search parameters or decode/re-encode a filename. */
export function publicStorageUrl(value: string, env: SupabasePublicEnv = process.env as SupabasePublicEnv): string {
  const publicBase = readSupabasePublicConfig(env).url
  const internalBase = readSupabasePublicConfig({
    NEXT_PUBLIC_SUPABASE_URL: env.SUPABASE_INTERNAL_URL?.trim() || publicBase,
  }).url
  if (!publicBase || !internalBase) throw new Error('Storage URL configuration is incomplete')

  const source = new URL(internalBase)
  let incoming: URL
  try { incoming = new URL(value) } catch { throw new Error('Unexpected storage URL from backend') }
  const storagePrefix = `${source.pathname.replace(/\/$/, '')}/storage/v1/object/`
  // The literal boundary also preserves every encoded path/query byte and
  // prevents lookalike hosts or API path prefixes from being rewritten.
  if (incoming.origin !== source.origin || incoming.username || incoming.password || incoming.hash ||
      !incoming.pathname.startsWith(storagePrefix) || !value.startsWith(`${internalBase}/storage/v1/object/`)) {
    throw new Error('Unexpected storage URL from backend')
  }
  return publicBase + value.slice(internalBase.length)
}
