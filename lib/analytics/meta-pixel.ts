/**
 * Explicit Meta image events. No third-party SDK can read enrollment fields,
 * observe private SPA routes or attach the real document URL/referrer.
 * Meta documents the image endpoint and standard event/custom-data parameters:
 * https://developers.facebook.com/documentation/meta-pixel/advanced/
 */
import { hasMarketingConsent } from '@/lib/analytics/consent'

declare global {
  interface Window {
    // Revoke an SDK left in memory by an earlier release/hot reload, if present.
    fbq?: (action: 'consent', eventName: 'revoke') => void
  }
}

export const META_PIXEL_ID = '1550332886706723'

/** Exact opt-in marketing surfaces; new routes require explicit review. */
export function isMetaMarketingPath(pathname: string): boolean {
  return /^\/(de|en|ru|uk|tr)(?:\/registration)?\/?$/.test(pathname)
}

export type StandardMetaEvent = 'PageView' | 'Lead' | 'CompleteRegistration' | 'Purchase' | 'SubmitApplication' | 'Contact' | 'ViewContent'
const EVENTS = new Set<StandardMetaEvent>(['PageView', 'Lead', 'CompleteRegistration', 'Purchase', 'SubmitApplication', 'Contact', 'ViewContent'])

export interface MetaEventParams {
  content_name?: string
  content_category?: string
  content_ids?: string[]
  currency?: string
  value?: number
  [key: string]: unknown
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const pending = new Map<HTMLImageElement, ReturnType<typeof setTimeout>>()
// Attribution stays in memory for this public funnel only, after consent.
let sitovClickAttribution: string | undefined

function existingMarketingCookie(name: '_fbc' | '_fbp'): string | undefined {
  const raw = document.cookie.split(';').map(cookie => cookie.trim()).find(cookie => cookie.startsWith(`${name}=`))?.slice(name.length + 1)
  // Ignore arbitrary cookie payloads and never forward user contact data.
  if (!raw || !/^fb\.\d\.\d{10,16}\.[A-Za-z0-9_-]{1,256}$/.test(raw)) return undefined
  const timestamp = Number(raw.split('.')[2])
  return timestamp <= Date.now() && Date.now() - timestamp <= 90 * 24 * 60 * 60 * 1000 ? raw : undefined
}

export function trackMetaEvent(eventName: StandardMetaEvent | string, params?: MetaEventParams): void {
  // A blocked cookie store or beacon must never turn a saved enrollment into
  // a failure, or ask a learner to submit the same registration again.
  try { sendMetaEvent(eventName, params) } catch { /* Analytics is best effort. */ }
}

function sendMetaEvent(eventName: StandardMetaEvent | string, params?: MetaEventParams): void {
  if (typeof window === 'undefined' || !hasMarketingConsent() || !isMetaMarketingPath(window.location.pathname) || !EVENTS.has(eventName as StandardMetaEvent)) return
  // A legacy resident SDK must not add automatic events or duplicate these.
  if (typeof window.fbq === 'function') {
    try { window.fbq('consent', 'revoke') } catch { /* Continue with the guarded beacon only. */ }
  }

  const query = new URLSearchParams({
    id: META_PIXEL_ID,
    ev: eventName,
    // Query strings, fragments and referrers can contain personal information.
    dl: `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}`,
    rl: '',
    if: 'false',
    ts: String(Date.now()),
  })
  const clickId = new URLSearchParams(window.location.search).get('fbclid')
  if (clickId && /^[A-Za-z0-9_-]{10,256}$/.test(clickId)) sitovClickAttribution = `fb.1.${Date.now()}.${clickId}`
  const fbc = sitovClickAttribution ?? existingMarketingCookie('_fbc')
  const fbp = existingMarketingCookie('_fbp')
  if (fbc) query.set('fbc', fbc)
  if (fbp) query.set('fbp', fbp)

  // Only the application's fixed funnel labels and public course IDs pass.
  // No arbitrary objects, URLs, contact fields or Advanced Matching data.
  if (params?.content_name && ['Kostenlose Probestunde', 'Kurseinschreibung'].includes(params.content_name)) query.set('cd[content_name]', params.content_name)
  if (params?.content_category && ['Trial Lesson', 'Course Enrollment'].includes(params.content_category)) query.set('cd[content_category]', params.content_category)
  if (params?.content_ids?.length && params.content_ids.length <= 10 && params.content_ids.every(id => UUID.test(id))) query.set('cd[content_ids]', JSON.stringify(params.content_ids))
  if (params?.currency === 'EUR') query.set('cd[currency]', 'EUR')
  if (typeof params?.value === 'number' && Number.isFinite(params.value) && params.value >= 0 && params.value <= 1_000_000) query.set('cd[value]', String(params.value))

  if (pending.size >= 20) return
  const pixel = new Image(1, 1)
  pixel.referrerPolicy = 'no-referrer'
  const finish = () => {
    const timer = pending.get(pixel)
    if (timer !== undefined) clearTimeout(timer)
    pending.delete(pixel)
    pixel.onload = null
    pixel.onerror = null
  }
  pixel.onload = finish
  pixel.onerror = finish
  pending.set(pixel, setTimeout(finish, 30_000))
  try { pixel.src = `https://www.facebook.com/tr?${query}` } catch { finish() }
}

/** Stop future events and release pending resources on any tab's withdrawal. */
export function revokeMetaPixel(): void {
  sitovClickAttribution = undefined
  for (const [pixel, timer] of pending) {
    clearTimeout(timer)
    pixel.onload = null
    pixel.onerror = null
    pixel.removeAttribute('src')
  }
  pending.clear()
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    try { window.fbq('consent', 'revoke') } catch { /* Analytics never blocks the interface. */ }
  }
}
