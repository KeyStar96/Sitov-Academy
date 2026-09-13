import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/supabase/database.types'
import { readSupabasePublicConfig, SUPABASE_COOKIE_NAME } from '@/lib/supabase-env'

/**
 * Wird geworfen, wenn `NEXT_PUBLIC_SUPABASE_URL` und/oder
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` im Browser-Bundle fehlen. Aufrufer (z.B.
 * `lib/audio/upload.ts`) können gezielt auf diesen Fehlertyp reagieren,
 * statt ihn wie einen generischen Netzwerk- oder Storage-Fehler zu behandeln.
 */
export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SupabaseConfigError'
  }
}

/** Browser values must use literal NEXT_PUBLIC accesses for Next.js build-time substitution. */
export function createClient() {
  let config: ReturnType<typeof readSupabasePublicConfig>
  try {
    config = readSupabasePublicConfig({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    })
  } catch {
    throw new SupabaseConfigError('Ungültige Supabase-Konfiguration: Eine selbst gehostete HTTP- oder HTTPS-Adresse wird benötigt.')
  }
  const { url, anonKey } = config
  if (!url || !anonKey) {
    console.error(
      'NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY müssen beim Build des Browser-Bundles gesetzt sein.',
      { hasUrl: Boolean(url), hasAnonKey: Boolean(anonKey) }
    )
    throw new SupabaseConfigError('Supabase-Konfiguration fehlt: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY sind im Browser nicht gesetzt.')
  }
  return createBrowserClient<Database>(url, anonKey, { cookieOptions: { name: SUPABASE_COOKIE_NAME, secure: process.env.NODE_ENV === 'production' } })
}
