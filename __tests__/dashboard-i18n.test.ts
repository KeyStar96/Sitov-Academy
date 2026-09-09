import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import tr from '@/dictionaries/tr.json'
import uk from '@/dictionaries/uk.json'
import { DASHBOARD_FALLBACKS, createDashboardTranslator } from '@/lib/dashboard-i18n'
import { PROFILE_FALLBACKS, createProfileTranslator } from '@/lib/profile-i18n'
import { VIDEO_FALLBACKS, createVideoTranslator } from '@/lib/videos-i18n'
import { ADMIN_FALLBACKS, createAdminTranslator } from '@/lib/admin-i18n'

const DICTIONARIES = { de, en, ru, tr, uk } as const

function missingKeys(
  fallbacks: Record<string, string>,
  section: Readonly<Record<string, string>>
): string[] {
  return Object.keys(fallbacks).filter((key) => !(key in section) || section[key].trim().length === 0)
}

describe('Lernplattform-Dictionaries', () => {
  it.each(Object.keys(DICTIONARIES))('%s enthält alle Dashboard-Schlüssel', (locale) => {
    const section = DICTIONARIES[locale as keyof typeof DICTIONARIES].dashboard as Readonly<Record<string, string>>
    expect(missingKeys(DASHBOARD_FALLBACKS, section)).toEqual([])
  })

  it.each(Object.keys(DICTIONARIES))('%s enthält alle Video-Schlüssel', (locale) => {
    const section = DICTIONARIES[locale as keyof typeof DICTIONARIES].videos as Readonly<Record<string, string>>
    expect(missingKeys(VIDEO_FALLBACKS, section)).toEqual([])
  })

  it.each(Object.keys(DICTIONARIES))('%s enthält alle Profil-Schlüssel', (locale) => {
    const section = DICTIONARIES[locale as keyof typeof DICTIONARIES].profile as Readonly<Record<string, string>>
    expect(missingKeys(PROFILE_FALLBACKS, section)).toEqual([])
  })

  it.each(Object.keys(DICTIONARIES))('%s enthält alle Admin-Schlüssel', (locale) => {
    const section = DICTIONARIES[locale as keyof typeof DICTIONARIES].admin as Readonly<Record<string, string>>
    expect(missingKeys(ADMIN_FALLBACKS, section)).toEqual([])
    for (const key of Object.keys(ADMIN_FALLBACKS)) {
      expect((section[key].match(/\{\w+\}/g) ?? []).sort()).toEqual((de.admin[key as keyof typeof de.admin].match(/\{\w+\}/g) ?? []).sort())
    }
  })

  it('setzt den Namen in die Begrüßung ein', () => {
    const t = createDashboardTranslator(de.dashboard)
    expect(t('hello', { name: 'Anna' })).toContain('Anna')
  })

  it('hebt das Niveau im Titel hervor, ohne HTML im Dictionary', () => {
    expect(de.dashboard.title_highlight).toBe('Sprachniveau')
    expect(de.dashboard.title_before).not.toContain('<span')
  })

  it('übersetzt die Folgemonat-Navigation', () => {
    const t = createAdminTranslator(en.admin)
    expect(t('nav_bookings')).toBe('Next-month bookings')
    expect(t('student_count', { count: 2 })).toContain('2')
  })

  it('übersetzt die Erstsprache im Profil', () => {
    const t = createProfileTranslator(en.profile)
    expect(t('lang_russian')).toBe('Russian')
  })

  it('behält den {title}-Platzhalter in der Video-ARIA', () => {
    const t = createVideoTranslator(de.videos)
    expect(t('open_external_aria')).toContain('{title}')
    expect(t('open_external_aria', { title: 'Nicos Weg' })).toContain('Nicos Weg')
  })
})
