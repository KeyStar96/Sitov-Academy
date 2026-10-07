/**
 * Phase 7.2 — Meta-Pixel nur nach Opt-in.
 * Ohne Einwilligung: kein Meta-Request. Einwilligung ist granular und widerrufbar.
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
import { isMetaMarketingPath, revokeMetaPixel, trackMetaEvent } from '@/lib/analytics/meta-pixel'

let mockPathname = '/de'
let pixels: HTMLImageElement[] = []
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }))

const de = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'dictionaries', 'de.json'), 'utf-8'))
const copy = de.consent

function pixelScript() {
  return document.getElementById('meta-pixel')
}

beforeEach(() => {
  revokeMetaPixel()
  mockPathname = '/de'
  window.history.replaceState(null, '', '/de')
  pixels = []
  jest.spyOn(window, 'Image').mockImplementation((width, height) => {
    const pixel = document.createElement('img')
    pixel.width = width ?? 0
    pixel.height = height ?? 0
    pixels.push(pixel)
    return pixel
  })
  window.localStorage.clear()
  delete window.fbq
  document.getElementById('meta-pixel')?.remove()
})

afterEach(() => {
  revokeMetaPixel()
  jest.restoreAllMocks()
  jest.useRealTimers()
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

  it('sendet nach Einwilligung ein explizites Ereignis ohne Meta-SDK', () => {
    saveConsent(true)
    trackMetaEvent('Lead', { value: 0 })
    expect(pixels).toHaveLength(1)
    const url = new URL(pixels[0].src)
    expect(url.origin).toBe('https://www.facebook.com')
    expect(url.searchParams.get('ev')).toBe('Lead')
    expect(url.searchParams.get('cd[value]')).toBe('0')
    expect(pixels[0].referrerPolicy).toBe('no-referrer')
    expect(window.fbq).toBeUndefined()
  })

  it('überträgt weder URL-Parameter, Fragmente, Referrer noch Kontaktfelder', () => {
    window.history.replaceState(null, '', '/de/registration?email=private%40example.test&token=secret#password-reset')
    saveConsent(true)
    trackMetaEvent('Purchase', { content_name: 'private@example.test', content_category: 'secret', content_ids: ['private@example.test'], currency: 'EUR', value: 120, email: 'private@example.test', event_source_url: 'https://secret.test' })
    const url = new URL(pixels[0].src)
    expect(url.searchParams.get('dl')).toBe(`${window.location.origin}/de/registration`)
    expect(url.searchParams.get('rl')).toBe('')
    expect(url.searchParams.get('cd[currency]')).toBe('EUR')
    expect(url.searchParams.get('cd[value]')).toBe('120')
    expect(url.toString()).not.toMatch(/private|secret|password|email|token/)
    expect(pixels[0].referrerPolicy).toBe('no-referrer')
  })

  it('behält nur gültige Werbeklick-Zuordnung nach Opt-in im laufenden öffentlichen Weg', () => {
    window.history.replaceState(null, '', '/de?fbclid=validAdClick_1234&email=private%40example.test')
    trackMetaEvent('PageView')
    expect(pixels).toHaveLength(0)
    saveConsent(true)
    trackMetaEvent('PageView')
    const attribution = new URL(pixels[0].src).searchParams.get('fbc')
    expect(attribution).toMatch(/^fb\.1\.\d+\.validAdClick_1234$/)
    window.history.replaceState(null, '', '/de/registration')
    trackMetaEvent('Lead')
    expect(new URL(pixels[1].src).searchParams.get('fbc')).toBe(attribution)
    revokeMetaPixel()
    trackMetaEvent('Lead')
    expect(new URL(pixels[2].src).searchParams.has('fbc')).toBe(false)
  })

  it('überträgt nur freigegebene öffentliche Kursdaten und begrenzt ausstehende Beacons', () => {
    saveConsent(true)
    trackMetaEvent('Purchase', { content_name: 'Kurseinschreibung', content_category: 'Course Enrollment', content_ids: ['00000000-0000-4000-8000-000000000001'], currency: 'EUR', value: 75 })
    const query = new URL(pixels[0].src).searchParams
    expect(query.get('cd[content_name]')).toBe('Kurseinschreibung')
    expect(query.get('cd[content_ids]')).toBe('["00000000-0000-4000-8000-000000000001"]')
    for (let i = 0; i < 30; i++) trackMetaEvent('PageView')
    expect(pixels).toHaveLength(20)
    pixels[0].dispatchEvent(new Event('load'))
    trackMetaEvent('PageView')
    expect(pixels).toHaveLength(21)
    revokeMetaPixel()
    expect(pixels.every(pixel => pixel.getAttribute('src') === null)).toBe(false)
    expect(pixels.slice(1).every(pixel => pixel.getAttribute('src') === null)).toBe(true)
  })

  it('lässt blockierte Marketing-Technik nicht in die Anmeldung durchschlagen', () => {
    saveConsent(true)
    jest.spyOn(document, 'cookie', 'get').mockImplementation(() => { throw new Error('blocked cookie access') })
    expect(() => trackMetaEvent('Lead')).not.toThrow()
    expect(pixels).toHaveLength(0)
  })

  it.each(['/de/dashboard', '/de/admin', '/de/staff-security', '/de/login', '/de/register', '/de/forgot-password', '/de/reset-password', '/de/privacy', '/de/registration/private', '/de/reise/beim-baecker', '/de/sitov-preview/motion', '/auth/callback', '/xx', '/de-registration'])('sendet mit Einwilligung auf %s nichts', pathname => {
    window.history.replaceState(null, '', pathname)
    saveConsent(true)
    trackMetaEvent('Lead')
    expect(pixels).toHaveLength(0)
    expect(isMetaMarketingPath(pathname)).toBe(false)
  })

  it.each(['de', 'en', 'ru', 'uk', 'tr'])('erlaubt nur die expliziten öffentlichen Seiten in %s', locale => {
    expect(isMetaMarketingPath(`/${locale}`)).toBe(true)
    expect(isMetaMarketingPath(`/${locale}/registration`)).toBe(true)
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

  it('sendet den ersten Seitenaufruf erst nach „Alle akzeptieren“ und lädt kein Fremdskript', async () => {
    render(<ConsentManager lang="de" copy={copy} />)
    expect(pixelScript()).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.accept_all })) })
    expect(consentStatus()).toBe('granted')
    expect(pixelScript()).toBeNull()
    expect(pixels).toHaveLength(1)
    expect(new URL(pixels[0].src).searchParams.get('ev')).toBe('PageView')
    expect(document.head.innerHTML + document.body.innerHTML).not.toContain('connect.facebook.net')
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
    for (const pathname of ['/ru/dashboard/level/A1.1/vocabulary', '/de/admin/content', '/de/staff-security']) {
      mockPathname = pathname
      const { unmount } = render(<ConsentManager lang="de" copy={copy} />)
      expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument()
      expect(pixelScript()).toBeNull()
      unmount()
    }
  })

  it('widerruft bei privater SPA-Navigation und sendet bei der Rückkehr nur den öffentlichen Aufruf', () => {
    saveConsent(true)
    const fbq = jest.fn()
    window.fbq = fbq
    const { rerender } = render(<ConsentManager lang="de" copy={copy} />)
    expect(pixels).toHaveLength(1)
    mockPathname = '/de/dashboard'
    window.history.replaceState(null, '', mockPathname)
    rerender(<ConsentManager lang="de" copy={copy} />)
    expect(fbq).toHaveBeenCalledWith('consent', 'revoke')
    expect(pixels[0].getAttribute('src')).toBeNull()
    trackMetaEvent('Lead')
    expect(pixels).toHaveLength(1)
    mockPathname = '/de/registration'
    window.history.replaceState(null, '', mockPathname)
    rerender(<ConsentManager lang="de" copy={copy} />)
    expect(pixels).toHaveLength(2)
    expect(new URL(pixels[1].src).searchParams.get('dl')).toBe(`${window.location.origin}/de/registration`)
  })

  it.each(['denied', 'removed', 'cleared', 'invalid'])('setzt tabübergreifenden Widerruf oder ungültige Zustimmung um: %s', change => {
    saveConsent(true)
    const fbq = jest.fn()
    window.fbq = fbq
    render(<ConsentManager lang="de" copy={copy} />)
    expect(pixels).toHaveLength(1)
    act(() => {
      if (change === 'denied') window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ version: CONSENT_VERSION, marketing: false, decidedAt: new Date().toISOString() }))
      else if (change === 'invalid') window.localStorage.setItem(CONSENT_STORAGE_KEY, '{}')
      else if (change === 'cleared') window.localStorage.clear()
      else window.localStorage.removeItem(CONSENT_STORAGE_KEY)
      window.dispatchEvent(new StorageEvent('storage', { key: change === 'cleared' ? null : CONSENT_STORAGE_KEY }))
    })
    expect(fbq).toHaveBeenCalledWith('consent', 'revoke')
    expect(pixels[0].getAttribute('src')).toBeNull()
    trackMetaEvent('Lead')
    expect(pixels).toHaveLength(1)
    expect(document.documentElement.dataset.consent).toBe(change === 'denied' ? 'set' : 'open')
    expect(screen.queryByTestId('consent-banner') !== null).toBe(change !== 'denied')
  })

  it('widerruft beim Ablauf in einer weiterhin geöffneten Seite', () => {
    jest.useFakeTimers()
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ version: CONSENT_VERSION, marketing: true, decidedAt: new Date(Date.now() - CONSENT_MAX_AGE_MS + 50).toISOString() }))
    const fbq = jest.fn()
    window.fbq = fbq
    const { unmount } = render(<ConsentManager lang="de" copy={copy} />)
    expect(pixels).toHaveLength(1)
    act(() => { jest.advanceTimersByTime(51) })
    expect(consentStatus()).toBe('unset')
    expect(fbq).toHaveBeenCalledWith('consent', 'revoke')
    expect(pixels[0].getAttribute('src')).toBeNull()
    expect(screen.getByTestId('consent-banner')).toBeInTheDocument()
    unmount()
    expect(jest.getTimerCount()).toBe(0)
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
  it.each(['de', 'en', 'uk', 'ru', 'tr'])('%s: erklärt die gesonderte Aufnahmevoraussetzung und Widerrufsmöglichkeit ohne Freiwilligkeitsversprechen', locale => {
    const dict = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'dictionaries', `${locale}.json`), 'utf-8'))
    expect(dict.registration.flow.consents.recording_notice).toBeTruthy()
    expect(dict.registration.legal.video_recording).toContain('info@sitov-academy.com')
    const recordingSection = dict.privacy.sections.find((section: { title: string }) => section.title.startsWith('9.'))
    const recordingTexts = [dict.registration.flow.consents.intro, dict.registration.flow.consents.video_recording,
      dict.registration.flow.consents.recording_notice, dict.registration.legal.video_recording,
      recordingSection.content[0], recordingSection.content[8], dict.agb.sections[1].content[3],
      dict.profile.recording_consent, dict.profile.recording_notice, dict.profile.recording_withdrawal]
    expect(recordingTexts.every(value => typeof value === 'string' && value.trim().length > 0)).toBe(true)
    const recordingCopy = recordingTexts.join(' ')
    expect(recordingCopy).toContain('Microsoft Teams')
    expect(recordingCopy).not.toMatch(/freiwillig|voluntary|optional|without this consent|без этого согласия|добровольн|добровільн|gönüllü|isteğe bağlı/i)
    expect(recordingSection.content[8]).toMatch(/Privatunterricht|private lessons|Индивидуальн|Індивідуальн|özel dersler/i)
    expect(recordingSection.content[11]).toContain('30')
    expect(recordingSection.content[13]).toContain('info@sitov-academy.com')
  })
})
