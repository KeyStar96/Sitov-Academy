import { isIP } from 'node:net'
import { headers } from 'next/headers'

/** Contract: Internet -> Traefik -> Nginx -> loopback-only Next.js.
 * Traefik discards untrusted forwarding headers and Nginx appends its peer.
 * TRUSTED_PROXY_HOPS=1 counts trailing proxy addresses in XFF, not sockets.
 * Nginx's app location must accept only Traefik. Never use this parser on a
 * publicly reachable application socket or a shorter, alternative proxy path.
 */
export function parseTrustedClientIp(forwarded: string | null, hops: string | undefined): string {
  if (hops !== '1' || !forwarded) return 'unknown'
  const parts = forwarded.split(',').map(part => part.trim())
  if (parts.length < 2 || !isIP(parts[parts.length - 1])) return 'unknown'
  const ip = parts[parts.length - 2]
  const version = isIP(ip)
  if (!version) return 'unknown'
  if (version === 4) return ip
  // Canonical spelling prevents different IPv6 representations sharing no bucket.
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1)
  const mapped = /^::ffff:([a-f0-9]+):([a-f0-9]+)$/.exec(canonical)
  if (!mapped) return canonical
  const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16)
  return [high >> 8, high & 255, low >> 8, low & 255].join('.')
}

export async function getClientIp(): Promise<string> {
  try {
    return parseTrustedClientIp((await headers()).get('x-forwarded-for'), process.env.TRUSTED_PROXY_HOPS)
  } catch {
    console.error('[client-ip] lookup_failed')
    return 'unknown'
  }
}
