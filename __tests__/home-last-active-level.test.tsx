import { render, screen } from '@testing-library/react'
import de from '@/dictionaries/de.json'
import ru from '@/dictionaries/ru.json'
import { loadLastActiveLevel } from '@/lib/last-active-level'
import { studentTranslator } from '@/lib/student-ui-i18n'
import type { LevelLearningStatus } from '@/lib/learning-status-server'

/**
 * Phase 2.6: Home folgt dem zuletzt gelernten Niveau (get_last_active_level),
 * nicht dem ersten angefangenen. Die Seite wird als echte Server-Komponente
 * gerendert; nur die Datenquellen sind ersetzt.
 */
jest.unmock('lucide-react')
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/lib/dictionary', () => ({
  getDictionary: async (lang: string) => (lang === 'ru' ? jest.requireActual('@/dictionaries/ru.json') : jest.requireActual('@/dictionaries/de.json')),
}))
jest.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: '00000000-0000-4000-8000-000000000001', email: 'anna@example.test' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { person: { display_name: 'Anna' } } }) }) }) }),
  }),
}))
jest.mock('@/app/actions/progress', () => ({ getAllLevelsProgress: async () => ({ 'A1.1': 50 }) }))
jest.mock('@/app/actions/feedback', () => ({ getUnseenFeedbackSummary: async () => ({ count: 0, latestLevel: null, latest: null }) }))
jest.mock('@/app/actions/pronunciation-conversations', () => ({ markPronunciationSeen: jest.fn() }))
jest.mock('@/lib/access/server', () => ({
  loadLevelAccessProfile: async () => ({ role: 'student', ui_language: 'ru', native_language: 'ru', allowed_levels: ['A1.1', 'A1.2'], trainer_grants: [] }),
}))
jest.mock('@/lib/profile-dashboard-server', () => ({ loadProfileMonthlyState: async () => null }))
jest.mock('@/lib/profile-course-calendar-server', () => ({ loadProfileCourseCalendar: async () => null }))
jest.mock('@/lib/last-active-level', () => ({ loadLastActiveLevel: jest.fn() }))
jest.mock('@/lib/learning-status-server', () => ({
  loadWeekActivity: async () => null,
  loadLevelLearningStatus: jest.fn(async ({ level, lang }: { level: string; lang: string }): Promise<LevelLearningStatus> => ({
    level, lessons: [], ownWords: null,
    vocabulary: { locked: lang === 'de', due: 3, activeWords: 10, total: 20, learned: 0 },
    grammar: { locked: lang === 'de', total: 10, solved: 2, topics: 5, openTopics: 4 },
    pronunciation: { locked: lang === 'de', texts: 2, open: 2, waiting: 0, unread: 0 },
    media: { locked: false, total: 1, fresh: 0 },
  })),
  modeLock: (_profile: unknown, _level: string, lang: string, mode: string) => mode !== 'media' && lang === 'de' ? 'language' : null,
}))

// Nach den Mocks laden: Die Seite importiert die ersetzten Module.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DashboardPage = (require('@/app/[lang]/dashboard/page') as typeof import('@/app/[lang]/dashboard/page')).default

async function renderHome(lang: 'de' | 'ru') {
  render(await DashboardPage({ params: Promise.resolve({ lang }), searchParams: Promise.resolve({}) }))
}

beforeEach(() => jest.mocked(loadLastActiveLevel).mockReset())

it('zeigt „Deine Lernbereiche · A1.2", wenn zuletzt in A1.2 gelernt wurde — obwohl A1.1 halb fertig ist', async () => {
  jest.mocked(loadLastActiveLevel).mockResolvedValue({ level: 'A1.2', mode: 'vocabulary', source: 'activity',
    levels: [{ level: 'A1.2', mode: 'vocabulary', unitLabel: 'Lektion 1', topic: null }, { level: 'A1.1', mode: 'path', unitLabel: null, topic: 'Artikel' }] })
  await renderHome('ru')
  const t = studentTranslator('ru')
  expect(screen.getByRole('heading', { level: 2, name: t('areas_title_level', { level: 'A1.2' }) })).toBeInTheDocument()
  expect(t('areas_title_level', { level: 'A1.2' })).toBe(`${t('areas_title')} · A1.2`)
  // Der Knopf führt zum zuletzt genutzten Modus dieses Niveaus.
  expect(screen.getByRole('link', { name: t('continue_to_vocabulary') })).toHaveAttribute('href', '/ru/dashboard/level/A1.2/vocabulary')
  expect(screen.getByRole('link', { name: new RegExp(t('area_path')) })).toHaveAttribute('href', '/ru/dashboard/level/A1.2/exercises')
})

it('nennt auf Deutsch dieselbe Überschrift und führt bei gesperrtem Modus zur Übersicht', async () => {
  jest.mocked(loadLastActiveLevel).mockResolvedValue({ level: 'A1.2', mode: 'vocabulary', source: 'activity',
    levels: [{ level: 'A1.2', mode: 'vocabulary', unitLabel: null, topic: null }] })
  await renderHome('de')
  expect(screen.getByRole('heading', { level: 2, name: 'Deine Lernbereiche · A1.2' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Zur Übersicht A1.2' })).toHaveAttribute('href', '/de/dashboard/level/A1.2')
})

it('ohne Lernhandlung im Niveau: „Zum Lernpfad"', async () => {
  jest.mocked(loadLastActiveLevel).mockResolvedValue({ level: 'A1.1', mode: null, source: 'unlocked', levels: [] })
  await renderHome('ru')
  const t = studentTranslator('ru')
  expect(screen.getByRole('heading', { level: 2, name: t('areas_title_level', { level: 'A1.1' }) })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: t('continue_to_path') })).toHaveAttribute('href', '/ru/dashboard/level/A1.1/exercises')
})

it('fällt nur bei gescheiterter Abfrage auf das erste angefangene Niveau zurück', async () => {
  jest.mocked(loadLastActiveLevel).mockResolvedValue(null)
  await renderHome('ru')
  expect(screen.getByRole('heading', { level: 2, name: `${studentTranslator('ru')('areas_title')} · A1.1` })).toBeInTheDocument()
})

it('die Überschrift steht in allen Sprachen im Wörterbuch der Lernräume', () => {
  expect(de.dashboard.nav_home).toBe('Start')
  expect(ru.dashboard.nav_home).toBe(studentTranslator('ru')('nav_home'))
})
