import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    expect(MODE_SEGMENTS).toEqual({ vocabulary: 'vocabulary', path: 'path', pronunciation: 'pronunciation', media: 'videos', verbs: 'verbs' })
    expect(LEARNING_MODES.map(mode => modeHref('ru', 'A1.1', mode))).toEqual([
      '/ru/dashboard/level/A1.1/vocabulary', '/ru/dashboard/level/A1.1/verbs', '/ru/dashboard/level/A1.1/path',
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
    ['/ru/dashboard/level/A1.1/verbs', 'area_verbs'],
  ] as const)('%s: genau ein aktiver Reiter mit aria-current', (path, label) => {
    mockPathname = path
    render(<ModeDock lang="ru" level="A1.1" entries={open()} />)
    const dock = screen.getByRole('navigation', { name: t('mode_dock_label', { level: 'A1.1' }) })
    const links = within(dock).getAllByRole('link')
    expect(links.map(link => link.textContent)).toEqual([t('area_vocabulary'), t('area_verbs'), t('area_path'), t('area_pronunciation'), t('area_media')])
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
    expect(screen.getByRole('link', { name: tl('area_verbs') })).not.toHaveAttribute('data-locked')
  })

  it('ordnet auch unsortierte Einträge für Anzeige und Tastatur mit Verben direkt nach Vokabeln', async () => {
    mockPathname = '/ru/dashboard/level/A1.1'
    const entries = open({ path: { lock: 'teacher' } }).reverse()
    const inputOrder = entries.map(entry => entry.mode)
    render(<ModeDock lang="ru" level="A1.1" entries={entries} />)
    const user = userEvent.setup()
    const order: string[] = []
    for (let index = 0; index < 5; index += 1) { await user.tab(); order.push(document.activeElement?.getAttribute('data-mode') ?? '') }
    expect(order).toEqual(['vocabulary', 'verbs', 'path', 'pronunciation', 'media'])
    expect(entries.map(entry => entry.mode)).toEqual(inputOrder)
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
    ['Verbtrainer', '/de/dashboard/level/B2/verbs', ['Start', 'B2', 'Verbtrainer']],
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
    for (const [segment, key] of [['vocabulary', 'area_vocabulary'], ['exercises', 'area_path'], ['pronunciation', 'area_pronunciation'], ['videos', 'area_media'], ['verbs', 'area_verbs']] as const) {
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

describe('Feste Hauptnavigation', () => {
  it('bleibt beim Scrollen verfügbar und macht nur für eine Bildschirmtastatur Platz', () => {
    expect(decideTabbar({ focusInBar: false, keyboard: false })).toBe('visible')
    expect(decideTabbar({ focusInBar: false, keyboard: true })).toBe('hidden')
    expect(decideTabbar({ focusInBar: true, keyboard: true })).toBe('visible')
  })

  it('bleibt bei Scrollen, Seitenwechsel und anschließendem Moduswechsel sichtbar', async () => {
    const view = () => <div className="academy-student-shell">
      <nav className="st-mode-dock"><a href="#vocabulary">Vokabeln</a></nav>
      <StudentNavigation lang="de" firstLevel="A1.1" levels={['A1.1']} supportLabels={labels} lastActiveLevel="A1.1" />
    </div>
    const { rerender } = render(view())
    const shell = document.querySelector('.academy-student-shell')!
    fireEvent.pointerDown(screen.getByRole('link', { name: 'Lernen' }), { pointerType: 'touch' })
    mockPathname = '/de/dashboard/level/A1.1'
    rerender(view())
    for (const y of [300, 600, 580, 900, 4000, 0]) {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: y })
      fireEvent.scroll(window)
      await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)) })
      expect(shell).toHaveAttribute('data-tabbar', 'visible')
    }
    await act(async () => {
      screen.getByRole('link', { name: 'Vokabeln' }).focus()
      await new Promise(resolve => requestAnimationFrame(resolve))
    })
    expect(shell).toHaveAttribute('data-tabbar', 'visible')
  })

  it('verschwindet bei einer Touch-Eingabe und kehrt beim Verlassen des Felds zurück', async () => {
    const original = window.matchMedia
    window.matchMedia = jest.fn(query => ({ ...original(query), matches: query === '(pointer: coarse)' }))
    try {
      render(<div className="academy-student-shell"><input aria-label="Antwort" />
        <StudentNavigation lang="de" firstLevel="A1.1" levels={['A1.1']} supportLabels={labels} />
      </div>)
      const shell = document.querySelector('.academy-student-shell')!
      const input = screen.getByRole('textbox', { name: 'Antwort' })
      input.focus()
      await waitFor(() => expect(shell).toHaveAttribute('data-tabbar', 'hidden'))
      input.blur()
      await waitFor(() => expect(shell).toHaveAttribute('data-tabbar', 'visible'))
    } finally { window.matchMedia = original }
  })

  it.each(['de', 'en', 'ru', 'uk', 'tr'])('macht die Deutschreise in %s direkt erreichbar', lang => {
    mockPathname = `/${lang}/dashboard/daily-quest`
    render(<StudentNavigation lang={lang} firstLevel="A1.1" levels={['A1.1']} supportLabels={labels} />)
    const journey = screen.getAllByRole('link').find(link => link.getAttribute('href') === `/${lang}/dashboard/daily-quest`)!
    expect(journey).toHaveAttribute('aria-current', 'page')
    expect(journey).not.toHaveTextContent('daily-quest')
    expect(screen.getAllByRole('link').filter(link => link.hasAttribute('aria-current'))).toHaveLength(1)
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

  it('nutzt bei einer fehlgeschlagenen Abfrage einen accountneutralen Rückfall', () => {
    window.localStorage.setItem('sitov:last-level', 'A1.2')
    render(<StudentNavigation lang="de" firstLevel="A1.1" levels={['A1.1', 'A1.2']} supportLabels={labels} />)
    expect(learn()).toHaveAttribute('href', '/de/dashboard/level/A1.1')
    expect(window.localStorage.getItem('sitov:last-level')).toBeNull()
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
