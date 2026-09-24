/**
 * Phase 7.2 — Meta-Pixel nur nach Opt-in.
 * Ohne Einwilligung: kein Pixel-Skript, kein fbq-Aufruf. Einwilligung ist granular und widerrufbar.
 */
import fs from 'fs'
import path from 'path'
import { act, fireEvent, render, screen } from '@testing-library/react'
import ConsentManager from '@/components/analytics/ConsentManager'
import ConsentSettingsButton from '@/components/analytics/ConsentSettingsButton'
import {
  CONSENT_BOOTSTRAP_SCRIPT,
  CONSENT_MAX_AGE_MS,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  consentStatus,
  parseConsent,
  saveConsent,
} from '@/lib/analytics/consent'
import { META_PIXEL_BOOTSTRAP, trackMetaEvent } from '@/lib/analytics/meta-pixel'

let mockPathname = '/de'
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }))

const de = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'dictionaries', 'de.json'), 'utf-8'))
const copy = de.consent

function pixelScript() {
  return document.getElementById('meta-pixel')
}

beforeEach(() => {
  mockPathname = '/de'
  window.localStorage.clear()
  delete window.fbq
  document.getElementById('meta-pixel')?.remove()
})

describe('Einwilligungs-Speicher', () => {
  const now = Date.parse('2026-09-24T10:00:00Z')
  const record = (overrides: Record<string, unknown> = {}) => JSON.stringify({ version: CONSENT_VERSION, marketing: true, decidedAt: '2026-09-01T10:00:00Z', ...overrides })

  it('akzeptiert nur vollständige, aktuelle Entscheidungen', () => {
    expect(parseConsent(record(), now)).toEqual({ version: CONSENT_VERSION, marketing: true, decidedAt: '2026-09-01T10:00:00Z' })
    expect(parseConsent(null, now)).toBeNull()
    expect(parseConsent('kaputt', now)).toBeNull()
    expect(parseConsent(record({ version: CONSENT_VERSION + 1 }), now)).toBeNull()
    expect(parseConsent(record({ marketing: 'yes' }), now)).toBeNull()
    expect(parseConsent(record({ decidedAt: '2027-01-01T00:00:00Z' }), now)).toBeNull()
  })

  it('fragt nach 12 Monaten erneut', () => {
    const decidedAt = new Date(now - CONSENT_MAX_AGE_MS - 1000).toISOString()
    expect(parseConsent(record({ decidedAt }), now)).toBeNull()
  })

  it('gilt ohne Entscheidung als „keine Einwilligung“', () => {
    expect(consentStatus()).toBe('unset')
    saveConsent(false)
    expect(consentStatus()).toBe('denied')
    saveConsent(true)
    expect(consentStatus()).toBe('granted')
  })
})

describe('Bootstrap vor dem ersten Paint', () => {
  function runBootstrap(raw: string | null) {
    delete document.documentElement.dataset.consent
    if (raw === null) window.localStorage.removeItem(CONSENT_STORAGE_KEY)
    else window.localStorage.setItem(CONSENT_STORAGE_KEY, raw)
    new Function(CONSENT_BOOTSTRAP_SCRIPT)()
    return document.documentElement.dataset.consent
  }
  const fresh = new Date(Date.now() - 60_000).toISOString()

  it.each([
    ['keine Entscheidung', null],
    ['kaputtes JSON', '{'],
    ['falsche Version', JSON.stringify({ version: CONSENT_VERSION + 1, marketing: true, decidedAt: fresh })],
    ['abgelaufen', JSON.stringify({ version: CONSENT_VERSION, marketing: false, decidedAt: new Date(Date.now() - CONSENT_MAX_AGE_MS - 60_000).toISOString() })],
    ['ohne Datum', JSON.stringify({ version: CONSENT_VERSION, marketing: false })],
    ['Zahl statt Objekt', '5'],
  ])('öffnet das Banner bei %s – wie parseConsent', (_label, raw) => {
    expect(runBootstrap(raw)).toBe('open')
    expect(parseConsent(raw)).toBeNull()
  })

  it.each([true, false])('blendet das Banner bei gültiger Entscheidung (marketing=%s) vorab aus', marketing => {
    const raw = JSON.stringify({ version: CONSENT_VERSION, marketing, decidedAt: fresh })
    expect(runBootstrap(raw)).toBe('set')
    expect(parseConsent(raw)).not.toBeNull()
  })

  it('markiert eine Entscheidung in derselben Sitzung', () => {
    runBootstrap(null)
    saveConsent(false)
    expect(document.documentElement.dataset.consent).toBe('set')
  })
})

describe('trackMetaEvent', () => {
  it('sendet ohne Marketing-Einwilligung nichts – auch wenn fbq existiert', () => {
    const fbq = jest.fn()
    window.fbq = fbq
    trackMetaEvent('Lead', { value: 0 })
    saveConsent(false)
    trackMetaEvent('Purchase', { value: 120 })
    expect(fbq).not.toHaveBeenCalled()
  })

  it('sendet nach Einwilligung', () => {
    const fbq = jest.fn()
    window.fbq = fbq
    saveConsent(true)
    trackMetaEvent('Lead', { value: 0 })
    expect(fbq).toHaveBeenCalledWith('track', 'Lead', { value: 0 })
  })
})

describe('ConsentManager', () => {
  it('zeigt das Banner ohne Entscheidung und lädt kein Pixel', () => {
    render(<ConsentManager lang="de" copy={copy} />)
    expect(screen.getByRole('region', { name: copy.title })).toBeInTheDocument()
    expect(screen.getByTestId('consent-banner')).toHaveAttribute('data-prompt', 'auto')
    expect(screen.getByRole('link', { name: copy.privacy_link })).toHaveAttribute('href', '/de/privacy')
    expect(pixelScript()).toBeNull()
  })

  it('bietet Ablehnen gleichwertig zum Akzeptieren an und lädt danach nichts', () => {
    render(<ConsentManager lang="de" copy={copy} />)
    const reject = screen.getByRole('button', { name: copy.reject_all })
    const accept = screen.getByRole('button', { name: copy.accept_all })
    expect(reject.className).toBe(accept.className)
    fireEvent.click(reject)
    expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument()
    expect(consentStatus()).toBe('denied')
    expect(pixelScript()).toBeNull()
  })

  it('lädt das Pixel erst nach „Alle akzeptieren“ über next/script', async () => {
    render(<ConsentManager lang="de" copy={copy} />)
    expect(pixelScript()).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.accept_all })) })
    expect(consentStatus()).toBe('granted')
    const script = pixelScript()
    expect(script).not.toBeNull()
    expect(script?.innerHTML).toContain("fbq('init', '1550332886706723')")
    expect(document.head.innerHTML + document.body.innerHTML).not.toContain('<noscript')
  })

  it('erlaubt die granulare Auswahl: Marketing bleibt standardmäßig aus', () => {
    render(<ConsentManager lang="de" copy={copy} />)
    fireEvent.click(screen.getByRole('button', { name: copy.customize }))
    expect(screen.getByText(copy.always_active)).toBeInTheDocument()
    const marketing = screen.getByRole('switch', { name: copy.marketing_label })
    expect(marketing).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: copy.save }))
    expect(consentStatus()).toBe('denied')
    expect(pixelScript()).toBeNull()
  })

  it('lässt sich über „Cookie-Einstellungen“ erneut öffnen und widerrufen', async () => {
    saveConsent(true)
    const fbq = jest.fn()
    window.fbq = fbq
    render(<><ConsentSettingsButton label={copy.settings_button} /><ConsentManager lang="de" copy={copy} /></>)
    expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.settings_button })) })
    const marketing = screen.getByRole('switch', { name: copy.marketing_label })
    expect(marketing).toBeChecked()
    fireEvent.click(marketing)
    fireEvent.click(screen.getByRole('button', { name: copy.save }))
    expect(consentStatus()).toBe('denied')
    expect(fbq).toHaveBeenCalledWith('consent', 'revoke')
    expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument()
  })

  it('überdeckt Lernraum und Lehrerbereich nicht automatisch', () => {
    for (const pathname of ['/ru/dashboard/level/A1.1/vocabulary', '/de/admin/content']) {
      mockPathname = pathname
      const { unmount } = render(<ConsentManager lang="de" copy={copy} />)
      expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument()
      expect(pixelScript()).toBeNull()
      unmount()
    }
  })

  it('initialisiert das Pixel mit erteilter Einwilligung', () => {
    expect(META_PIXEL_BOOTSTRAP).toContain("fbq('consent', 'grant')")
    expect(META_PIXEL_BOOTSTRAP.indexOf("fbq('consent', 'grant')")).toBeLessThan(META_PIXEL_BOOTSTRAP.indexOf("fbq('init'"))
  })
})

describe('Wörterbücher', () => {
  it.each(['de', 'en', 'uk', 'ru', 'tr'])('%s: Datenschutzerklärung nennt Meta-Pixel, Einwilligung und Drittlandtransfer', locale => {
    const dict = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'dictionaries', `${locale}.json`), 'utf-8'))
    const privacy = JSON.stringify(dict.privacy)
    expect(privacy).toContain('8.6 Meta')
    expect(privacy).toContain('controller_addendum')
    expect(privacy).toContain('Data Privacy Framework')
    expect(privacy).toContain(CONSENT_STORAGE_KEY)
    expect(Object.values(dict.consent).every(value => typeof value === 'string' && value.trim().length > 0)).toBe(true)
  })
})
