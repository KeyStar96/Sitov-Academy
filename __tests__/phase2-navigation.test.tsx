import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ModeDock, { type ModeDockEntry } from '@/components/dashboard/ModeDock'
import DashboardHeader from '@/components/layout/DashboardHeader'
import StudentNavigation, { decideTabbar } from '@/components/dashboard/StudentNavigation'
import VocabularyTabs from '@/components/vocabulary/VocabularyTabs'
import { buildBreadcrumbs } from '@/lib/breadcrumbs'
import { createDashboardTranslator } from '@/lib/dashboard-i18n'
import { LEARNING_MODES, MODE_SEGMENTS, lessonsHref, modeFromPathname, modeHref } from '@/lib/mode-targets'
import { studentTranslator } from '@/lib/student-ui-i18n'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'

let mockPathname = '/de/dashboard'
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}))
jest.unmock('lucide-react')

const DICTIONARIES = { de, en, ru, uk, tr } as const
const open = (overrides: Partial<Record<ModeDockEntry['mode'], Partial<ModeDockEntry>>> = {}): ModeDockEntry[] =>
  LEARNING_MODES.map(mode => ({ mode, lock: null, ...overrides[mode] }))
const labels = { whatsapp: 'WhatsApp', phone: '+49 1', phoneLabel: 'Anrufen', telegram: 'Telegram', email: 'a@b.test', emailLabel: 'E-Mail' }

beforeEach(() => { window.localStorage.clear(); mockPathname = '/de/dashboard' })

describe('Modus-Ziele an einer Stelle', () => {
  it('führen bis Phase 3 zum bestehenden Grammatik-Trainer und erkennen jeden Modus an seiner Route', () => {
    expect(MODE_SEGMENTS).toEqual({ vocabulary: 'vocabulary', path: 'path', pronunciation: 'pronunciation', media: 'videos' })
    expect(LEARNING_MODES.map(mode => modeHref('ru', 'A1.1', mode))).toEqual([
      '/ru/dashboard/level/A1.1/vocabulary', '/ru/dashboard/level/A1.1/path',
      '/ru/dashboard/level/A1.1/pronunciation', '/ru/dashboard/level/A1.1/videos'])
    expect(lessonsHref('ru', 'A1.1')).toBe('/ru/dashboard/level/A1.1/vocabulary/lessons')
    expect(modeFromPathname('/ru/dashboard/level/A1.1/vocabulary/lessons')).toBe('vocabulary')
    expect(modeFromPathname('/ru/dashboard/level/A1.1/videos/123')).toBe('media')
    expect(modeFromPathname('/ru/dashboard/level/A1.1/media')).toBe('media')
    expect(modeFromPathname('/ru/dashboard/level/A1.1')).toBeNull()
  })

  it('stehen nirgends sonst im Lernraum als Routen-Literal', () => {
    // Phase 3 stellt nur lib/mode-targets.ts um; eine zweite Stelle würde vergessen.
    const offenders: string[] = []
    const walk = (directory: string) => {
      for (const name of readdirSync(directory)) {
        const path = join(directory, name)
        if (statSync(path).isDirectory()) { walk(path); continue }
        if (!/\.tsx?$/.test(name)) continue
        const source = readFileSync(path, 'utf8')
        if (/level\/\$\{[^}]+\}\/exercises|\/exercises`/.test(source)) offenders.push(path)
      }
    }
    for (const directory of ['components/dashboard', 'components/layout', 'app/[lang]/dashboard/page.tsx', 'app/[lang]/dashboard/level/[level]/page.tsx']) {
      const path = resolve(process.cwd(), directory)
      if (statSync(path).isDirectory()) walk(path)
      else if (/level\/\$\{[^}]+\}\/exercises|\/exercises`/.test(readFileSync(path, 'utf8'))) offenders.push(path)
    }
    expect(offenders).toEqual([])
  })
})

describe('Modus-Dock', () => {
  const t = studentTranslator('ru')

  it.each([
    ['/ru/dashboard/level/A1.1/vocabulary', 'area_vocabulary'],
    ['/ru/dashboard/level/A1.1/vocabulary/lessons', 'area_vocabulary'],
    ['/ru/dashboard/level/A1.1/path', 'area_path'],
    ['/ru/dashboard/level/A1.1/pronunciation', 'area_pronunciation'],
    ['/ru/dashboard/level/A1.1/videos', 'area_media'],
  ] as const)('%s: genau ein aktiver Reiter mit aria-current', (path, label) => {
    mockPathname = path
    render(<ModeDock lang="ru" level="A1.1" entries={open()} />)
    const dock = screen.getByRole('navigation', { name: t('mode_dock_label', { level: 'A1.1' }) })
    const links = within(dock).getAllByRole('link')
    expect(links.map(link => link.textContent)).toEqual([t('area_vocabulary'), t('area_path'), t('area_pronunciation'), t('area_media')])
    const current = links.filter(link => link.getAttribute('aria-current') === 'page')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent(t(label))
    expect(current[0].querySelector('[data-sliding-pill]')).not.toBeNull()
  })

  it('markiert auf der Niveau-Übersicht keinen Modus als aktiv', () => {
    mockPathname = '/ru/dashboard/level/A1.1'
    render(<ModeDock lang="ru" level="A1.1" entries={open()} />)
    expect(screen.getAllByRole('link').filter(link => link.hasAttribute('aria-current'))).toHaveLength(0)
  })

  it('zeigt fällige Karten und ungelesene Antworten als Zahl und im Namen', () => {
    mockPathname = '/ru/dashboard/level/A1.1'
    render(<ModeDock lang="ru" level="A1.1" entries={open({ vocabulary: { count: 12 }, pronunciation: { count: 1 }, media: { fresh: true } })} />)
    expect(screen.getByRole('link', { name: `${t('area_vocabulary')}, ${t.count('status_vocab_due', 12)}` })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: `${t('area_pronunciation')}, ${t.count('status_pron_unread', 1)}` })).toBeInTheDocument()
    // Platz für „Neu" (Phase 6 füllt ihn aus der Gesehen-Quittung).
    expect(within(screen.getByRole('link', { name: new RegExp(t('area_media')) })).getByText(t('media_new'))).toHaveClass('sr-only')
  })

  it('gesperrte Modi zeigen ein Schloss, nennen den Grund und führen zur Erklärung, nicht in eine Aufgabe', () => {
    mockPathname = '/ru/dashboard/level/A1.1'
    render(<ModeDock lang="ru" level="A1.1" entries={open({ path: { lock: 'teacher' }, pronunciation: { lock: 'teacher', count: 4 } })} />)
    const path = screen.getByRole('link', { name: `${t('area_path')}, ${t('mode_locked')}` })
    expect(path).toHaveAttribute('data-locked', 'teacher')
    expect(path).toHaveAttribute('href', '/ru/dashboard/level/A1.1/path')
    expect(path.querySelector('.lucide-lock')).not.toBeNull()
    // Gesperrt: keine Zahl, die zum Üben einlädt.
    expect(screen.getByRole('link', { name: `${t('area_pronunciation')}, ${t('mode_locked')}` })).not.toHaveTextContent('4')
  })

  it.each(['de', 'en', 'ru', 'uk', 'tr'] as const)('deutsche Oberfläche: Trainer gesperrt mit Hinweis auf die Lernsprache, Mediathek offen (%s-Texte)', lang => {
    const tl = studentTranslator(lang)
    mockPathname = `/${lang}/dashboard/level/A1.1`
    const entries = open({ vocabulary: { lock: 'language' }, path: { lock: 'language' }, pronunciation: { lock: 'language' } })
    render(<ModeDock lang={lang} level="A1.1" entries={entries} />)
    for (const key of ['area_vocabulary', 'area_path', 'area_pronunciation'] as const) {
      expect(screen.getByRole('link', { name: `${tl(key)}, ${tl('mode_locked_language')}` })).toHaveAttribute('data-locked', 'language')
    }
    expect(screen.getByRole('link', { name: tl('area_media') })).not.toHaveAttribute('data-locked')
  })

  it('ist mit der Tastatur in Dock-Reihenfolge erreichbar', async () => {
    mockPathname = '/ru/dashboard/level/A1.1'
    render(<ModeDock lang="ru" level="A1.1" entries={open({ path: { lock: 'teacher' } })} />)
    const user = userEvent.setup()
    const order: string[] = []
    for (let index = 0; index < 4; index += 1) { await user.tab(); order.push(document.activeElement?.getAttribute('data-mode') ?? '') }
    expect(order).toEqual(['vocabulary', 'path', 'pronunciation', 'media'])
  })
})

describe('Brotkrumen mit vollem Pfad', () => {
  const t = createDashboardTranslator(de.dashboard)
  const trail = (path: string) => buildBreadcrumbs(path, 'de', t, 'Video').map(crumb => crumb.name)

  it.each([
    ['Home', '/de/dashboard', ['Start']],
    ['Niveau', '/de/dashboard/level/A1.1', ['Start', 'A1.1']],
    ['Vokabeln / Lernbox', '/de/dashboard/level/A1.1/vocabulary', ['Start', 'A1.1', 'Vokabeln']],
    ['Vokabeln / Lektionen', '/de/dashboard/level/A1.1/vocabulary/lessons', ['Start', 'A1.1', 'Vokabeln', 'Lektionen']],
    ['Aussprache', '/de/dashboard/level/A1.1/pronunciation', ['Start', 'A1.1', 'Aussprache']],
    ['Mediathek', '/de/dashboard/level/A1.1/videos', ['Start', 'A1.1', 'Mediathek']],
    ['Lernpfad', '/de/dashboard/level/A1.1/path', ['Start', 'A1.1', 'Lernpfad']],
    ['Video', '/de/dashboard/level/A1.1/videos/5f0c', ['Start', 'A1.1', 'Mediathek', 'Video']],
    ['Kalender', '/de/dashboard/calendar', ['Start', 'Kalender']],
  ])('%s', (_, path, expected) => {
    expect(trail(path)).toEqual(expected)
  })

  it('kennt die Pfad-Routen von Phase 3 schon: Pfad n, Knoten, Test', () => {
    expect(trail('/de/dashboard/level/A1.1/path/3/node/test')).toEqual(['Start', 'A1.1', 'Lernpfad', 'Pfad 3', 'Knoten', 'Test'])
  })

  it.each(Object.keys(DICTIONARIES) as (keyof typeof DICTIONARIES)[])('heißen in %s wie die Reiter im Dock', lang => {
    const crumbs = buildBreadcrumbs(`/${lang}/dashboard/level/A1.1/vocabulary`, lang, createDashboardTranslator(DICTIONARIES[lang].dashboard))
    const s = studentTranslator(lang)
    expect(crumbs[0].name).toBe(s('nav_home'))
    for (const [segment, key] of [['vocabulary', 'area_vocabulary'], ['exercises', 'area_path'], ['pronunciation', 'area_pronunciation'], ['videos', 'area_media']] as const) {
      const name = buildBreadcrumbs(`/${lang}/dashboard/level/A1.1/${segment}`, lang, createDashboardTranslator(DICTIONARIES[lang].dashboard)).at(-1)!.name
      expect(name).toBe(s(key))
    }
  })

  it('zeigt am Handy wie am PC alle Glieder: Links davor, das letzte als Überschrift mit aria-current', () => {
    mockPathname = '/de/dashboard/level/A1.1/vocabulary/lessons'
    render(<DashboardHeader lang="de" translations={de.dashboard} breadcrumbLabel="Brotkrumen" />)
    const nav = screen.getByRole('navigation', { name: 'Brotkrumen' })
    const items = within(nav).getAllByRole('listitem')
    expect(items.map(item => item.textContent)).toEqual(['Start', 'A1.1', 'Vokabeln', 'Lektionen'])
    expect(within(nav).getAllByRole('link').map(link => link.getAttribute('href')))
      .toEqual(['/de/dashboard', '/de/dashboard/level/A1.1', '/de/dashboard/level/A1.1/vocabulary'])
    expect(within(nav).getByRole('heading', { level: 1, name: 'Lektionen' })).toHaveAttribute('aria-current', 'page')
    // Kein verstecktes Handy-Menü mehr: keine Klassen, die die Spur nur ab md zeigen.
    expect(nav.className).not.toMatch(/hidden/)
  })
})

describe('Untere Leiste (D8)', () => {
  const base = { focusInBar: false, keyboard: false, dialog: false, viewport: 800, height: 3000, travel: 20 }

  it('verschwindet beim Runterscrollen und kommt beim Hochscrollen zurück — erst ab 56 px Tiefe und 8 px Weg', () => {
    expect(decideTabbar({ ...base, y: 400, direction: 1 })).toBe('hidden')
    expect(decideTabbar({ ...base, y: 400, direction: -1 })).toBe('visible')
    expect(decideTabbar({ ...base, y: 400, direction: 1, travel: 7 })).toBeNull()
    expect(decideTabbar({ ...base, y: 56, direction: 1 })).toBe('visible')
  })

  it('bleibt oben, am Seitenende, bei Fokus in der Leiste und bei offenem Blatt sichtbar', () => {
    expect(decideTabbar({ ...base, y: 0, direction: 1 })).toBe('visible')
    expect(decideTabbar({ ...base, y: 2200, direction: 1 })).toBe('visible')
    expect(decideTabbar({ ...base, y: 400, direction: 1, focusInBar: true })).toBe('visible')
    expect(decideTabbar({ ...base, y: 400, direction: 1, dialog: true })).toBe('visible')
  })

  it('macht bei offener Bildschirmtastatur Platz — außer der Fokus liegt in der Leiste selbst', () => {
    expect(decideTabbar({ ...base, y: 0, direction: -1, keyboard: true })).toBe('hidden')
    expect(decideTabbar({ ...base, y: 400, direction: -1, keyboard: true, dialog: true })).toBe('hidden')
    expect(decideTabbar({ ...base, y: 400, direction: 1, keyboard: true, focusInBar: true })).toBe('visible')
  })

  it('setzt den Zustand als Attribut am Wurzelelement', () => {
    render(<div className="academy-student-shell"><StudentNavigation lang="de" firstLevel="A1.1" levels={['A1.1']} supportLabels={labels} lastActiveLevel="A1.1" /></div>)
    expect(document.querySelector('.academy-student-shell')).toHaveAttribute('data-tabbar', 'visible')
  })
})

describe('Reiter „Lernen" folgt get_last_active_level', () => {
  const t = studentTranslator('de')
  const learn = () => screen.getByRole('link', { name: t('nav_learn') })

  it('führt zum zuletzt gelernten Niveau, nicht zum Browser-Speicher', () => {
    window.localStorage.setItem('sitov:last-level', 'A1.1')
    render(<StudentNavigation lang="de" firstLevel="A1.1" levels={['A1.1', 'A1.2']} supportLabels={labels} lastActiveLevel="A1.2" />)
    expect(learn()).toHaveAttribute('href', '/de/dashboard/level/A1.2')
  })

  it('nutzt den Browser-Speicher nur, wenn die Abfrage scheitert', () => {
    window.localStorage.setItem('sitov:last-level', 'A1.2')
    render(<StudentNavigation lang="de" firstLevel="A1.1" levels={['A1.1', 'A1.2']} supportLabels={labels} />)
    expect(learn()).toHaveAttribute('href', '/de/dashboard/level/A1.2')
  })

  it('fällt ohne Ergebnis auf das erste freigeschaltete Niveau zurück und ignoriert gesperrte', () => {
    render(<StudentNavigation lang="de" firstLevel="A1.1" levels={['A1.1']} supportLabels={labels} lastActiveLevel="B1.1" />)
    expect(learn()).toHaveAttribute('href', '/de/dashboard/level/A1.1')
  })
})

describe('Modus Vokabeln: Lernbox | Lektionen', () => {
  const t = studentTranslator('de')
  it('zeigt beide Ansichten mit der aktuellen markiert', () => {
    mockPathname = '/de/dashboard/level/A1.1/vocabulary/lessons'
    render(<VocabularyTabs lang="de" level="A1.1" />)
    expect(screen.getByRole('link', { name: t('vocab_tab_lessons') })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: t('vocab_tab_box') })).toHaveAttribute('href', '/de/dashboard/level/A1.1/vocabulary')
  })
  it('verschwindet in Einstufung und Lernrunde', () => {
    mockPathname = '/de/dashboard/level/A1.1/vocabulary/assess'
    const { container } = render(<VocabularyTabs lang="de" level="A1.1" />)
    expect(container).toBeEmptyDOMElement()
  })
})
