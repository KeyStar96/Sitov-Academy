interface SitovSecurityHeaderEnv {
  NEXT_PUBLIC_SUPABASE_URL?: string
}

/** Browser destinations only: never expose the private Supabase/API address. */
function sitovPublicStorageOrigins(env: SitovSecurityHeaderEnv): string[] {
  if (!env.NEXT_PUBLIC_SUPABASE_URL?.trim()) return []
  const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL.trim())
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Invalid public Supabase origin for Sitov Academy security headers')
  }
  return [url.origin]
}

/**
 * Compatible with static Next pages, motion styles, recordings and private PDF
 * previews. Inline scripts remain allowed until rendering uses per-request
 * nonces or build-time hashes. This policy still blocks unapproved external
 * scripts/connections, object injection, base changes and cross-site framing.
 */
export function sitovSecurityHeaders(env: SitovSecurityHeaderEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
}) {
  const storage = sitovPublicStorageOrigins(env)
  const realtime = storage.map(origin => origin.replace(/^http/, 'ws'))
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    // Existing vocabulary illustrations may reference externally hosted images.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${[...storage, ...realtime].join(' ')}`.trim(),
    `media-src 'self' blob: data: ${storage.join(' ')}`.trim(),
    `frame-src 'self' blob: ${storage.join(' ')}`.trim(),
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ]
  const enforced = directives.join('; ')
  return [
    { key: 'Content-Security-Policy', value: enforced },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ]
}
