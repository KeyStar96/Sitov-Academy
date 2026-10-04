import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ModeDock from '@/components/dashboard/ModeDock'
import StudentNavigation from '@/components/dashboard/StudentNavigation'
import LevelCard from '@/components/dashboard/home/LevelCard'
import LevelNewTracker from '@/components/dashboard/LevelNewTracker'
import ProfileNotificationSettings from '@/components/dashboard/ProfileNotificationSettings'
import { useLearningNew } from '@/components/dashboard/useLearningNew'
import { markLearningSeen } from '@/app/actions/learning-new'
import { setMailPreference } from '@/app/actions/profile'
import { LEARNING_MODES } from '@/lib/mode-targets'
import { modeIsNew, newModes, parseLearningNewCounts, parseLearningNewItems, trainerKey } from '@/lib/learning-new'
import { STUDENT_MESSAGES, studentTranslator } from '@/lib/student-ui-i18n'

let mockPathname = '/de/dashboard/level/A1.1/vocabulary'
const refresh = jest.fn()
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname, useRouter: () => ({ refresh, push: jest.fn() }) }))
jest.mock('@/app/actions/learning-new', () => ({ markLearningSeen: jest.fn() }))
jest.mock('@/app/actions/profile', () => ({ setMailPreference: jest.fn() }))
jest.unmock('lucide-react')

const labels = { whatsapp: 'WhatsApp', phone: '+49 1', phoneLabel: 'Anrufen', telegram: 'Telegram', email: 'a@b.test', emailLabel: 'E-Mail' }
const zero = { vocabulary: 0, path: 0, pronunciation: 0, media: 0, verbs: 0 }
const none = { vocabulary: false, path: false, pronunciation: false, media: false, verbs: false }
const answer = (levels: Record<string, unknown>) => ({ success: true, any: Object.keys(levels).length > 0, levels, visited: ['A1.1'] })

beforeEach(() => {
  jest.clearAllMocks()
  mockPathname = '/ru/dashboard/level/A1.1/vocabulary'
  jest.mocked(markLearningSeen).mockResolvedValue({ success: true, marked: true })
})

describe('Neu-Antworten der Datenbank', () => {
  it('werden geprüft gelesen; eine fehlerhafte Antwort zeigt nichts als neu', () => {
    const level = { level: false, total: 2, modes: { ...zero, media: 2 }, modeNew: none }
    expect(parseLearningNewCounts(answer({ 'A1.1': level }))).toEqual({ any: true, levels: { 'A1.1': level }, visited: ['A1.1'] })
    expect(parseLearningNewCounts({ error: 'request_failed', message: 'x' })).toBeNull()
    expect(parseLearningNewCounts(answer({ 'A1.1': { ...level, total: -1 } }))).toBeNull()
    expect(parseLearningNewItems({ error: 'not_authenticated' })).toEqual({ items: {}, lessonIds: {} })
    expect(parseLearningNewItems({ success: true, items: { video: ['a'], nonsense: ['b'], path: [] }, lessons: { u1: 'Lektion 2' } }))
      .toEqual({ items: { video: ['a'] }, lessonIds: { 'Lektion 2': 'u1' } })
  })

  it('kennzeichnen einen Modus bei neuen Inhalten oder wenn der Modus selbst neu ist', () => {
    const entry = { level: false, total: 3, modes: { ...zero, media: 2 }, modeNew: { ...none, pronunciation: true } }
    expect(LEARNING_MODES.map(mode => modeIsNew(entry, mode))).toEqual([false, false, false, true, true])
    expect(newModes(entry)).toEqual(['pronunciation', 'media'])
    expect(modeIsNew(undefined, 'media')).toBe(false)
    expect(trainerKey('A1.1', 'exercises')).toBe('A1.1:exercises')
  })
})

describe('Kennzeichen an den genannten Stellen', () => {
  it('Modus-Reiter: Punkt und zugänglicher Name; gesperrte Modi nie', () => {
    render(<ModeDock lang="de" level="A1.1" entries={LEARNING_MODES.map(mode => ({ mode, lock: mode === 'path' ? 'teacher' as const : null, fresh: mode !== 'pronunciation' }))} />)
    expect(screen.getByRole('link', { name: /^Mediathek, Neu$/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Vokabeln, Neu$/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Lernpfad, / }).textContent).not.toMatch(/Neu/)
    expect(screen.getByRole('link', { name: /Aussprache/ }).textContent).not.toMatch(/Neu/)
  })

  it('Niveaukarte auf Home: Neu-Kennzeichen nur bei Neuem und nie an einem gesperrten Niveau', () => {
    const copy = { start: 'Starten', continueLearning: 'Weiter', lockedHint: 'Gesperrt', newLabel: 'Neu' }
    const { rerender } = render(<LevelCard id="A1.2" title="T" description="D" index={1} href="/x" locked={false} progress={0} copy={copy} fresh />)
    expect(screen.getByText('Neu')).toBeInTheDocument()
    rerender(<LevelCard id="A1.2" title="T" description="D" index={1} href="/x" locked={false} progress={0} copy={copy} />)
    expect(screen.queryByText('Neu')).not.toBeInTheDocument()
    rerender(<LevelCard id="A1.2" title="T" description="D" index={1} href="/x" locked progress={0} copy={copy} fresh />)
    expect(screen.queryByText('Neu')).not.toBeInTheDocument()
  })

  it('Hauptnavigation: Lernen bleibt auch bei neuen Inhalten ohne überlagernden Punkt', () => {
    const { rerender } = render(<StudentNavigation lang="de" firstLevel="A1.1" levels={['A1.1']} supportLabels={labels} lastActiveLevel="A1.1" learnNew />)
    expect(screen.getByRole('link', { name: 'Lernen' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lernen' }).querySelector('.st-tabbar__new')).toBeNull()
    expect(screen.queryByText('Neue Lerninhalte')).not.toBeInTheDocument()
    rerender(<StudentNavigation lang="de" firstLevel="A1.1" levels={['A1.1']} supportLabels={labels} lastActiveLevel="A1.1" />)
    expect(screen.queryByText('Neue Lerninhalte')).not.toBeInTheDocument()
  })
})

describe('Gesehen-Quittung beim Öffnen', () => {
  it('useLearningNew meldet nur neue Objekte, einmal, und nimmt das Kennzeichen sofort weg', async () => {
    const { result } = renderHook(() => useLearningNew({ video: ['v1'] }))
    expect(result.current.isNew('video', 'v1')).toBe(true)
    expect(result.current.isNew('video', 'other')).toBe(false)
    act(() => { result.current.mark('video', 'other'); result.current.mark('presentation', 'v1') })
    expect(markLearningSeen).not.toHaveBeenCalled()
    act(() => { result.current.mark('video', 'v1'); result.current.mark('video', 'v1') })
    expect(result.current.isNew('video', 'v1')).toBe(false)
    expect(markLearningSeen).toHaveBeenCalledTimes(1)
    expect(markLearningSeen).toHaveBeenCalledWith('video', 'v1')
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('mitten in einer Übung werden die Zähler erst beim Zurückkehren neu gelesen', async () => {
    const { result } = renderHook(() => useLearningNew({ path: ['p1'] }))
    act(() => { result.current.mark('path', 'p1', { refresh: false }) })
    await waitFor(() => expect(markLearningSeen).toHaveBeenCalled())
    expect(refresh).not.toHaveBeenCalled()
    act(() => { result.current.flush() })
    expect(refresh).toHaveBeenCalledTimes(1)
    act(() => { result.current.flush() })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('Niveau-Tracker: erster Besuch, neues Niveau und neuer Modus werden gemeldet, sonst nichts', async () => {
    const { rerender } = render(<LevelNewTracker level="A1.1" visit={false} levelNew={false} newModes={['media']} />)
    expect(markLearningSeen).not.toHaveBeenCalled()
    mockPathname = '/ru/dashboard/level/A1.1/videos'
    rerender(<LevelNewTracker level="A1.1" visit levelNew newModes={['media']} />)
    await waitFor(() => expect(markLearningSeen).toHaveBeenCalledTimes(2))
    expect(jest.mocked(markLearningSeen).mock.calls).toEqual([['level', 'A1.1'], ['trainer', 'A1.1:videos']])
    rerender(<LevelNewTracker level="A1.1" visit levelNew newModes={['media']} />)
    expect(markLearningSeen).toHaveBeenCalledTimes(2)
  })

  it('ein Fehler beim Melden bleibt still', async () => {
    jest.mocked(markLearningSeen).mockRejectedValue(new Error('offline'))
    render(<LevelNewTracker level="A1.1" visit levelNew={false} newModes={[]} />)
    await waitFor(() => expect(markLearningSeen).toHaveBeenCalled())
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('Schalter „Benachrichtigungen" (Phase 6.2)', () => {
  it('speichert sofort, bestätigt mit einer Meldung und zeigt den Zustand als Wort', async () => {
    jest.mocked(setMailPreference).mockResolvedValue({ success: true })
    render(<ProfileNotificationSettings lang="de" initial={{ pronunciation: true, new_content: true, reminders: true }} />)
    const toggle = screen.getByRole('switch', { name: /E-Mail, wenn meine Lehrkraft in der Aussprache antwortet/ })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(toggle.textContent).toMatch(/An ·/)
    await userEvent.click(toggle)
    expect(setMailPreference).toHaveBeenCalledWith('pronunciation', false)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(toggle.textContent).toMatch(/Aus ·/)
    expect(await screen.findByRole('status')).toHaveTextContent('Gespeichert.')
  })

  it('stellt den Schalter zurück und meldet den Fehler, wenn das Speichern scheitert', async () => {
    jest.mocked(setMailPreference).mockResolvedValue({ success: false })
    render(<ProfileNotificationSettings lang="en" initial={{ pronunciation: false, new_content: true, reminders: true }} />)
    const toggle = screen.getByRole('switch', { name: /teacher replies/ })
    await userEvent.click(toggle)
    expect(await screen.findByRole('status')).toHaveTextContent('That did not work. Please try again.')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('hat je optionaler Mail einen eigenen Schalter und nennt die Pflicht-Mails ohne Schalter (Phase 8)', async () => {
    jest.mocked(setMailPreference).mockResolvedValue({ success: true })
    render(<ProfileNotificationSettings lang="de" initial={{ pronunciation: true, new_content: true, reminders: false }} />)
    expect(screen.getAllByRole('switch')).toHaveLength(3)
    const content = screen.getByRole('switch', { name: /neuen Lerninhalten/ })
    const reminders = screen.getByRole('switch', { name: /Lern-Erinnerungen/ })
    expect(reminders).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(content)
    expect(setMailPreference).toHaveBeenLastCalledWith('new_content', false)
    await userEvent.click(reminders)
    expect(setMailPreference).toHaveBeenLastCalledWith('reminders', true)
    expect(reminders).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('notify-required')).toHaveTextContent(/Passwort zurücksetzen.*Registrierung.*Kursanmeldung/)
  })
})

describe('Fünf Sprachen', () => {
  it('haben alle neuen Texte gleichzeitig', () => {
    const keys = ['new_in_level', 'nav_learn_new', 'settings_notifications', 'settings_notifications_hint', 'notify_pronunciation', 'notify_pronunciation_hint', 'notify_saved', 'notify_error', 'notify_on', 'notify_off',
      'notify_new_content', 'notify_new_content_hint', 'notify_reminders', 'notify_reminders_hint', 'notify_required'] as const
    for (const lang of ['de', 'en', 'ru', 'uk', 'tr'] as const) {
      const s = studentTranslator(lang)
      for (const key of keys) expect(s(key)).toEqual(expect.any(String))
      expect(STUDENT_MESSAGES[lang].notify_on).not.toBe(STUDENT_MESSAGES[lang].notify_off)
    }
    expect(new Set(['de', 'en', 'ru', 'uk', 'tr'].map(lang => studentTranslator(lang)('notify_pronunciation'))).size).toBe(5)
  })
})
