/**
 * Einwilligungen (DSGVO Art. 6 Abs. 1 lit. a, § 25 Abs. 1 TDDDG).
 *
 * Notwendig ist immer aktiv; Marketing (Meta-Pixel) nur nach ausdrücklichem
 * Opt-in. Die Entscheidung selbst ist technisch notwendig und liegt nur im
 * Browser. Ohne gültige Entscheidung gilt: keine Einwilligung.
 */

export const CONSENT_STORAGE_KEY = 'sitov-consent'
/** Erhöhen, wenn sich Zwecke ändern: Alte Entscheidungen gelten dann nicht mehr. */
export const CONSENT_VERSION = 1
/** Nach 12 Monaten wird erneut gefragt. */
export const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000

const CHANGE_EVENT = 'sitov:consent-change'
const OPEN_EVENT = 'sitov:consent-open'

export interface ConsentRecord {
  version: number
  marketing: boolean
  decidedAt: string
}

/**
 * Läuft im `<head>` vor dem ersten Paint (wie das Theme-Bootstrap). Das Banner
 * steht im statischen HTML und wird so zusammen mit dem Hero gezeichnet statt
 * nach der Hydration – ein spät erscheinender Textblock würde sonst auf dem
 * Handy zum LCP-Element. Mit gültiger Entscheidung (oder ohne JavaScript)
 * bleibt es per CSS unsichtbar: `html[data-consent="open"]`.
 */
export const CONSENT_BOOTSTRAP_SCRIPT = `(()=>{let open=true;try{const v=JSON.parse(localStorage.getItem('${CONSENT_STORAGE_KEY}')||'null');const t=v&&typeof v.decidedAt==='string'?Date.parse(v.decidedAt):NaN;const now=Date.now();open=!(v&&v.version===${CONSENT_VERSION}&&typeof v.marketing==='boolean'&&t<=now&&now-t<=${CONSENT_MAX_AGE_MS})}catch{}document.documentElement.dataset.consent=open?'open':'set'})();`

/** `unset`: noch keine (gültige) Entscheidung, das Banner wird gezeigt. */
export type ConsentStatus = 'granted' | 'denied' | 'unset'

export function parseConsent(raw: string | null, now: number = Date.now()): ConsentRecord | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<ConsentRecord>
    if (value.version !== CONSENT_VERSION || typeof value.marketing !== 'boolean' || typeof value.decidedAt !== 'string') return null
    const decidedAt = Date.parse(value.decidedAt)
    if (!Number.isFinite(decidedAt) || decidedAt > now || now - decidedAt > CONSENT_MAX_AGE_MS) return null
    return { version: value.version, marketing: value.marketing, decidedAt: value.decidedAt }
  } catch {
    return null
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(CONSENT_STORAGE_KEY)
  } catch {
    return null
  }
}

export function readConsent(): ConsentRecord | null {
  if (typeof window === 'undefined') return null
  return parseConsent(readRaw())
}

export function consentStatus(): ConsentStatus {
  const record = readConsent()
  if (!record) return 'unset'
  return record.marketing ? 'granted' : 'denied'
}

export function hasMarketingConsent(): boolean {
  return consentStatus() === 'granted'
}

export function saveConsent(marketing: boolean): ConsentRecord {
  const record: ConsentRecord = { version: CONSENT_VERSION, marketing, decidedAt: new Date().toISOString() }
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Privater Modus o. Ä.: Die Entscheidung gilt dann nur für diese Seite.
  }
  document.documentElement.dataset.consent = 'set'
  window.dispatchEvent(new Event(CHANGE_EVENT))
  return record
}

/** Für `useSyncExternalStore`: Änderungen in diesem und in anderen Tabs. */
export function subscribeConsent(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => { if (event.key === null || event.key === CONSENT_STORAGE_KEY) onChange() }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

/** Öffnet die Einstellungen erneut (Widerruf so einfach wie die Erteilung). */
export function openConsentSettings(): void {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

export function subscribeConsentSettings(onOpen: () => void): () => void {
  window.addEventListener(OPEN_EVENT, onOpen)
  return () => window.removeEventListener(OPEN_EVENT, onOpen)
}
