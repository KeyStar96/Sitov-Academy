import 'server-only'
import { createHash } from 'node:crypto'
import { createAdminClient } from '@/utils/supabase/admin'
import { getRpcError } from '@/lib/rpc-errors'

export type RateLimitResult = { success: boolean; limit: number; remaining: number; reset: number }

export function parseWindowToMs(value: string): number {
  const match = /^(\d+)\s*(s|sec|seconds|m|min|minutes|h|hours)$/.exec(value.trim())
  if (!match) throw new Error('Invalid rate limit window')
  const unit = match[2][0]
  const windowMs = Number(match[1]) * (unit === 'h' ? 3600000 : unit === 'm' ? 60000 : 1000)
  if (!Number.isSafeInteger(windowMs) || windowMs < 1000 || windowMs > 86400000) {
    throw new Error('Rate limit window must be between one second and one day')
  }
  return windowMs
}

/** Atomic across every Next.js worker; identifiers are never stored in clear text. */
export async function rateLimit(identifier: string, limit = 10, window = '60 s'): Promise<RateLimitResult> {
  const windowMs = parseWindowToMs(window)
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10000) throw new Error('Invalid rate limit threshold')
  const key = createHash('sha256').update(`${identifier}:${limit}:${windowMs}`).digest('hex')
  try {
    const { data, error } = await createAdminClient().rpc('consume_rate_limit', {
      p_key: key, p_limit: limit, p_window_seconds: Math.ceil(windowMs / 1000),
    })
    const row = Array.isArray(data) ? data[0] : null
    const result = row && typeof row === 'object' && !Array.isArray(row) ? row : null
    const reset = typeof result?.reset_at === 'string' ? new Date(result.reset_at).getTime() : NaN
    if (error || getRpcError(data) || !result || typeof result.success !== 'boolean' || typeof result.remaining !== 'number' || !Number.isInteger(result.remaining)
      || result.remaining < 0 || result.remaining > limit || !Number.isFinite(reset)) {
      throw new Error('Local rate limit store unavailable')
    }
    return { success: result.success, limit, remaining: result.remaining, reset }
  } catch (error) {
    console.error('[ratelimit] Local limiter unavailable', error instanceof Error ? error.message : 'Unknown error')
    return { success: false, limit, remaining: 0, reset: Date.now() + windowMs }
  }
}
