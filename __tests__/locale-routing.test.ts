import {
  DEFAULT_LOCALE,
  isAuthPath,
  isLocaleExempt,
  isProtectedPath,
  localeFromPathname,
  mapLegacyLang,
  safeUiLanguageNextPath,
  shouldApplyLegacyLangRedirect,
} from '@/lib/locale-routing'

describe('isLocaleExempt', () => {
  it('nimmt die Bestätigungsroute aus', () => {
    expect(isLocaleExempt('/auth/confirm')).toBe(true)
    expect(isLocaleExempt('/auth/callback')).toBe(true)
    expect(isLocaleExempt('/auth')).toBe(true)
  })

  it('nimmt API-Routen aus', () => {
    expect(isLocaleExempt('/api/webhooks/stripe')).toBe(true)
  })

  it('lässt Lern- und Marketingpfade durch', () => {
    expect(isLocaleExempt('/de/login')).toBe(false)
    expect(isLocaleExempt('/dashboard')).toBe(false)
    expect(isLocaleExempt('/')).toBe(false)
  })
})

describe('shouldApplyLegacyLangRedirect', () => {
  it('leitet eine alte Startseiten-URL mit ?lang= um', () => {
    expect(shouldApplyLegacyLangRedirect('/', 'de')).toBe(true)
  })

  it('lässt /auth/confirm?lang=de unangetastet – sonst geht das Token verloren', () => {
    expect(shouldApplyLegacyLangRedirect('/auth/confirm', 'de')).toBe(false)
    expect(shouldApplyLegacyLangRedirect('/auth/callback', 'de')).toBe(false)
  })

  it('lässt Pfade mit Sprachpräfix unangetastet', () => {
    expect(shouldApplyLegacyLangRedirect('/de/login', 'en')).toBe(false)
  })

  it('tut nichts ohne lang-Parameter', () => {
    expect(shouldApplyLegacyLangRedirect('/', null)).toBe(false)
  })
})

describe('safeUiLanguageNextPath', () => {
  it('keeps the teacher on the same admin page after a language change', () => {
    expect(safeUiLanguageNextPath('/ru/admin/bookings', 'de')).toBe('/de/admin/bookings')
    expect(safeUiLanguageNextPath('/en/admin', 'uk')).toBe('/uk/admin')
  })

  it('falls back to the profile for missing or unsafe targets', () => {
    expect(safeUiLanguageNextPath(null, 'de')).toBe('/de/dashboard/profile')
    expect(safeUiLanguageNextPath('https://evil.example/phish', 'de')).toBe('/de/dashboard/profile')
    expect(safeUiLanguageNextPath('//evil.example', 'de')).toBe('/de/dashboard/profile')
    expect(safeUiLanguageNextPath('/login', 'de')).toBe('/de/dashboard/profile')
  })
})

describe('localeFromPathname', () => {
  it('liest das Sprachpräfix', () => {
    expect(localeFromPathname('/de/dashboard')).toBe('de')
    expect(localeFromPathname('/uk')).toBe('uk')
  })

  it('gibt ohne Präfix null zurück', () => {
    expect(localeFromPathname('/auth/confirm')).toBeNull()
    expect(localeFromPathname('/')).toBeNull()
  })
})

describe('mapLegacyLang', () => {
  it('übersetzt das alte Ukrainisch-Kürzel', () => {
    expect(mapLegacyLang('ua')).toBe('uk')
  })

  it('fällt bei Unbekanntem auf Deutsch zurück', () => {
    expect(mapLegacyLang('xx')).toBe(DEFAULT_LOCALE)
  })
})

describe('Routenschutz', () => {
  it('schützt Lernbereich und Lehrerbereich', () => {
    expect(isProtectedPath('/de/dashboard')).toBe(true)
    expect(isProtectedPath('/de/admin/submissions')).toBe(true)
    expect(isProtectedPath('/de/dashboard/level/A1.1')).toBe(true)
    expect(isProtectedPath('/de/login')).toBe(false)
  })

  it('erkennt Anmelde- und Registrierungsseiten', () => {
    expect(isAuthPath('/de/login')).toBe(true)
    expect(isAuthPath('/tr/register')).toBe(true)
    expect(isAuthPath('/de/dashboard')).toBe(false)
  })
})
