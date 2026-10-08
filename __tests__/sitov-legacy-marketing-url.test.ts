/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { sitovLegacyMarketingUrl } from '@/lib/sitov-legacy-marketing-url'

const mockUpdateSession = jest.fn()
jest.mock('@/utils/supabase/middleware', () => ({ updateSession: (...args: unknown[]) => mockUpdateSession(...args) }))
import { proxy } from '@/proxy'

const ORIGIN = 'https://www.sitov-academy.com'
const target = (path: string) => sitovLegacyMarketingUrl(new URL(path, ORIGIN))?.href ?? null

beforeEach(() => jest.clearAllMocks())

describe('bekannte alte Seitenlinks', () => {
  it.each([
    ['/AGB.html', '/de/agb'],
    ['/AGB.html?lang=en&utm_source=google', '/en/agb?utm_source=google'],
    ['/Impressum.html?lang=uk', '/uk/imprint'],
    ['/impressum?lang=en', '/en/imprint'],
    ['/impressum', '/de/imprint'],
    ['/ru/impressum?utm_medium=organic', '/ru/imprint?utm_medium=organic'],
    ['/en/AGB.html?lang=ru', '/en/agb?lang=ru'],
  ])('%s bleibt die passende Seite %s', (source, destination) => {
    expect(target(source)).toBe(`${ORIGIN}${destination}`)
  })

  it('verwendet ausschließlich die bestehende Origin und keine Ziel-URL aus der Query', () => {
    expect(target('/impressum?lang=%2F%2Fevil.example&next=https%3A%2F%2Fevil.example'))
      .toBe(`${ORIGIN}/de/imprint?next=https%3A%2F%2Fevil.example`)
  })

  it.each(['/de/imprint', '/ru/privacy', '/tr/cancellation', '/Impressum.html/unknown'])('erfindet für %s keine weitere Seitenzuordnung', source => {
    expect(target(source)).toBeNull()
  })
})

describe('Sprachparameter behalten den Seiteninhalt und übrige Query', () => {
  it.each([
    ['/?lang=ua&utm_source=telegram', '/uk?utm_source=telegram'],
    ['/registration?lang=ru&courseId=abc&trial=1&utm_campaign=autumn', '/ru/registration?courseId=abc&trial=1&utm_campaign=autumn'],
    ['/privacy?lang=tr', '/tr/privacy'],
    ['/agb?lang=en', '/en/agb'],
    ['/sitov-missing-seo-page?lang=en&utm_source=test', '/en/sitov-missing-seo-page?utm_source=test'],
  ])('%s führt auf %s', (source, destination) => {
    expect(target(source)).toBe(`${ORIGIN}${destination}`)
  })

  it('ändert eine explizite aktuelle Sprache nicht durch einen alten Query-Parameter', () => {
    expect(target('/de/registration?lang=ru&trial=1')).toBeNull()
  })

  it('mutiert den eingehenden URL-Wert nicht', () => {
    const url = new URL('/registration?lang=en&trial=1', ORIGIN)
    sitovLegacyMarketingUrl(url)
    expect(url.href).toBe(`${ORIGIN}/registration?lang=en&trial=1`)
  })

  it.each([
    '/auth/confirm?lang=en&token_hash=once&type=signup',
    '/auth/callback?lang=ru&code=once',
    '/api/health?lang=en',
    '/api/enrollment?lang=uk&token=once',
    '/de/auth/confirm?lang=en&token_hash=once',
    '/en/api/example?lang=ru&token=once',
  ])('berührt den Token-/API-Pfad %s nie', source => {
    expect(target(source)).toBeNull()
  })
})

describe('tatsächlicher Next.js-Proxy', () => {
  it('leitet Impressum dauerhaft auf die passende Sprachseite um', async () => {
    const response = await proxy(new NextRequest(`${ORIGIN}/impressum?lang=en&utm_source=google`))
    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe(`${ORIGIN}/en/imprint?utm_source=google`)
    expect(mockUpdateSession).not.toHaveBeenCalled()
  })

  it('behält eine unbekannte Route und reicht deren sprachpräfixierte Fassung an die 404-Behandlung weiter', async () => {
    const response = await proxy(new NextRequest(`${ORIGIN}/sitov-missing-seo-page?lang=tr`))
    expect(response.headers.get('location')).toBe(`${ORIGIN}/tr/sitov-missing-seo-page`)
    const localized = await proxy(new NextRequest(response.headers.get('location')!))
    expect(localized.headers.get('location')).toBeNull()
    expect(localized.headers.get('x-middleware-next')).toBe('1')
    expect(mockUpdateSession).not.toHaveBeenCalled()
  })

  it('übernimmt erneuerte Cookies und Cache-Schutz beim Sprachlink einer geschützten Seite', async () => {
    const sessionResponse = NextResponse.next()
    sessionResponse.cookies.set('sitov-session-test', 'renewed', { httpOnly: true })
    sessionResponse.headers.set('cache-control', 'private, no-store')
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: sessionResponse, user: { id: 'test' }, uiLanguage: 'en' })
    const response = await proxy(new NextRequest(`${ORIGIN}/dashboard/profile?lang=en&tab=language`))
    expect(response.headers.get('location')).toBe(`${ORIGIN}/en/dashboard/profile?tab=language`)
    expect(response.cookies.get('sitov-session-test')?.value).toBe('renewed')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it.each(['/auth/confirm?lang=en&token_hash=once', '/api/health?lang=ru'])('lässt %s ohne Weiterleitung und Session-Zugriff durch', async source => {
    const response = await proxy(new NextRequest(`${ORIGIN}${source}`))
    expect(response.headers.get('location')).toBeNull()
    expect(mockUpdateSession).not.toHaveBeenCalled()
  })
})
