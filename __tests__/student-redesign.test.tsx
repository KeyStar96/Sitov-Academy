import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import TodayPlan, { type TodayItem } from '@/components/dashboard/home/TodayPlan'
import WeekStrip from '@/components/dashboard/home/WeekStrip'
import KaraokeText from '@/components/audio/KaraokeText'
import Mailbox from '@/components/audio/Mailbox'
import LogoutButton from '@/components/dashboard/LogoutButton'
import StudentNavigation from '@/components/dashboard/StudentNavigation'
import ProfileSettings from '@/components/dashboard/ProfileSettings'
import { SessionBoxMoves, AssessmentResult } from '@/components/vocabulary/SuccessMoments'
import { buildWordTiles } from '@/components/exercises/FillInBlankExercise'
import { toStations } from '@/lib/lesson-stations'
import { courseSessionsInMonth } from '@/lib/profile-month'
import { studentTranslator, STUDENT_MESSAGES } from '@/lib/student-ui-i18n'
import { teacherFirstName, teacherPortrait } from '@/lib/teacher-portraits'
import { logout } from '@/app/actions/auth'
import { markPronunciationSeen } from '@/app/actions/pronunciation-conversations'
import type { PronunciationConversation } from '@/lib/pronunciation-conversations'

jest.unmock('lucide-react')
jest.mock('@/components/exercises/SolutionAudioButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/app/actions/auth', () => ({ logout: jest.fn() }))
jest.mock('@/app/actions/pronunciation-conversations', () => ({ markPronunciationSeen: jest.fn().mockResolvedValue({ success: true }), getPronunciationConversations: jest.fn() }))
jest.mock('@/components/audio/WaveformPlayer', () => ({ __esModule: true, default: ({ onProgress }: { onProgress?: (state: { playing: boolean; fraction: number; ended: boolean }) => void }) =>
  <button type="button" onClick={() => { onProgress?.({ playing: true, fraction: 0.2, ended: false }); onProgress?.({ playing: false, fraction: 1, ended: true }) }}>play</button> }))
jest.mock('next/navigation', () => ({ usePathname: () => '/de/dashboard/level/A1.2/exercises', useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }) }))

const t = studentTranslator('de')
const labels = { whatsapp: 'WhatsApp', phone: '+49 1', phoneLabel: 'Anrufen', telegram: 'Telegram', email: 'a@b.test', emailLabel: 'E-Mail' }

beforeEach(() => { jest.clearAllMocks(); window.localStorage.clear() })

describe('Heute für dich', () => {
  const week = { days: ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'], learned: ['2026-09-21', '2026-09-23'], today: '2026-09-23' }
  it('lists what is waiting and starts the first thing one can do', () => {
    const items: TodayItem[] = [
      { kind: 'course', label: 'Unterricht heute um 18:00 Uhr', href: '/de/dashboard/calendar', actionable: false },
      { kind: 'vocabulary', label: t.count('today_vocab', 48), href: '/de/dashboard/level/A1.1/vocabulary', actionable: true },
    ]
    render(<TodayPlan lang="de" name="Anna" items={items} fallbackHref="/de/dashboard/level/A1.1" week={week} noLevel={false} />)
    expect(screen.getByRole('link', { name: '48 Karten warten in deiner Lernbox' })).toHaveAttribute('href', '/de/dashboard/level/A1.1/vocabulary')
    const start = screen.getByRole('link', { name: /Jetzt starten/ })
    expect(start).toHaveAttribute('href', '/de/dashboard/level/A1.1/vocabulary')
    expect(start).toHaveTextContent(t('today_start_vocab'))
    expect(screen.getByText('Diese Woche an 2 von 7 Tagen gelernt')).toBeInTheDocument()
  })
  it('says when everything is done and leads to the learning path instead', () => {
    render(<TodayPlan lang="de" name="Anna" items={[]} fallbackHref="/de/dashboard/level/A1.1" week={null} noLevel={false} />)
    expect(screen.getByText(t('today_done_title'))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Jetzt starten/ })).toHaveAttribute('href', '/de/dashboard/level/A1.1')
  })
  it('marks learned days for screen readers without a streak to lose', () => {
    render(<WeekStrip lang="de" week={{ ...week, learned: [] }} />)
    expect(screen.getByText(t('week_empty'))).toBeInTheDocument()
    expect(screen.getByText(/Mittwoch \(heute\): nicht gelernt/)).toBeInTheDocument()
  })
})

describe('Lektionen', () => {
  it('marks fully started lessons as done and the first lesson with new words as current', () => {
    const stations = toStations([
      { lesson: 'Lektion 1', total: 10, active: 8, learned: 2, untouched: 0, due: 3 },
      { lesson: 'Lektion 2', total: 12, active: 4, learned: 0, untouched: 8, due: 0 },
      { lesson: 'Lektion 3', total: 9, active: 0, learned: 0, untouched: 9, due: 0 },
    ], lesson => `L ${lesson}`)
    expect(stations.map(station => [station.number, station.state, station.label])).toEqual([[1, 'done', 'L Lektion 1'], [2, 'current', 'L Lektion 2'], [3, 'open', 'L Lektion 3']])
  })
})

describe('Kalender', () => {
  it('counts the scheduled dates of a course within the booked month and its run', () => {
    // Oktober 2026: vier Dienstage (6., 13., 20., 27.) und fünf Donnerstage.
    expect(courseSessionsInMonth([{ weekday: 2 }], '2026-10-01', null, null)).toBe(4)
    expect(courseSessionsInMonth([{ weekday: 2 }, { weekday: 4 }], '2026-10-01', null, null)).toBe(9)
    expect(courseSessionsInMonth([{ weekday: 2 }], '2026-10-01', '2026-10-14', null)).toBe(2)
    expect(courseSessionsInMonth([], '2026-10-01', null, null)).toBeNull()
  })
})

describe('Grammatik-Kärtchen', () => {
  it('splits multi-word answers into word cards and keeps single answers whole', () => {
    expect(buildWordTiles(['ein Tisch', 'eine Tisch'], 'ein Tisch')).toEqual(['ein', 'Tisch', 'eine'])
    expect(buildWordTiles(['die die', 'der'], 'die die')).toEqual(['die', 'die', 'der'])
    expect(buildWordTiles(['lernst', 'lernt', 'lernst'], 'lernst')).toEqual(['lernst', 'lernt'])
  })
})

describe('Mitlesen', () => {
  it('highlights the word the reference audio has reached', () => {
    const { container, rerender } = render(<KaraokeText text={'Guten Tag! Ich heiße Anna.'} progress={null} />)
    expect(container.querySelector('[data-state]')).toBeNull()
    rerender(<KaraokeText text={'Guten Tag! Ich heiße Anna.'} progress={0.5} />)
    expect(container.querySelector('[data-state="current"]')).toHaveTextContent('Ich')
    expect(container.querySelectorAll('[data-state="read"]')).toHaveLength(2)
  })
})

describe('Briefkasten', () => {
  const now = new Date().toISOString()
  const conversation = (id: string, overrides: Partial<PronunciationConversation>): PronunciationConversation => ({
    id, level: 'A1.1', title: `Text ${id}`, promptId: `p-${id}`, readingText: null, status: 'reviewed', studentName: null, studentEmail: null,
    createdAt: now, hasUnseen: false, messages: [{ id: `${id}-rec`, senderRole: 'student', text: '', audioUrl: null, createdAt: now, unseen: false }], ...overrides,
  })
  it('puts new replies on top as letters, recordings without reply on their way and read ones in the archive', async () => {
    jest.useFakeTimers()
    render(<Mailbox lang="de" translations={{}} conversations={[
      conversation('new', { hasUnseen: true, messages: [{ id: 'm1', senderRole: 'teacher', text: 'Sehr schön!', audioUrl: 'https://audio.test/a.webm', createdAt: now, unseen: true, senderName: 'Anastasia Sitov' }] }),
      conversation('wait', { status: 'pending' }),
      conversation('old', { messages: [{ id: 'm2', senderRole: 'teacher', text: 'Gut', audioUrl: null, createdAt: now, unseen: false }] }),
    ]} />)
    expect(screen.getByRole('heading', { name: 'Von Anastasia' })).toBeInTheDocument()
    expect(screen.getByText('Sehr schön!')).toBeInTheDocument()
    expect(screen.getByText(t('mailbox_waiting_hint'), { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(t('mailbox_archive')) })).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'play' }))
    expect(markPronunciationSeen).toHaveBeenCalledWith('new')
    expect(screen.getByText(t('mailbox_heard'))).toBeInTheDocument()
    await act(async () => { jest.advanceTimersByTime(1300) })
    expect(screen.queryByRole('heading', { name: 'Von Anastasia' })).not.toBeInTheDocument()
    expect(screen.getByText(t('mailbox_archive_count', { count: 2 }))).toBeInTheDocument()
    jest.useRealTimers()
  })
  it('shows a teacher photo only for a known teacher and addresses her by first name', () => {
    expect(teacherPortrait('Anastasia Sitov')).toBe('/Bilder/Nastja.png')
    expect(teacherPortrait('Maria Muster')).toBeNull()
    expect(teacherFirstName('Anastasia Sitov')).toBe('Anastasia')
  })
})

describe('Navigation', () => {
  it('labels every tab, marks the learning area and opens help as a sheet', () => {
    render(<StudentNavigation lang="de" firstLevel="A1.1" levels={['A1.1', 'A1.2']} supportLabels={labels} />)
    const nav = screen.getByRole('navigation', { name: t('nav_label') })
    expect(within(nav).getByRole('link', { name: t('nav_learn') })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: t('nav_learn') })).toHaveAttribute('href', '/de/dashboard/level/A1.2')
    expect(window.localStorage.getItem('sitov:last-level')).toBe('A1.2')
    expect(within(nav).getByRole('link', { name: t('nav_calendar') })).toHaveAttribute('href', '/de/dashboard/calendar')
    fireEvent.click(within(nav).getByRole('button', { name: t('nav_help') }))
    expect(screen.getByRole('dialog', { name: t('help_title') })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/491714758620')
  })
  it('asks before logging out', () => {
    render(<LogoutButton lang="de" />)
    fireEvent.click(screen.getByRole('button', { name: t('nav_logout') }))
    expect(screen.getByRole('dialog', { name: t('logout_title') })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: t('logout_cancel') }))
    expect(logout).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: t('nav_logout') }))
    fireEvent.click(screen.getByRole('button', { name: t('logout_confirm') }))
    expect(logout).toHaveBeenCalledWith('de')
  })
})

describe('Einstellungen', () => {
  const sections = [
    { id: 'details' as const, title: 'Meine Daten', hint: 'Name', content: <p>Formular</p> },
    { id: 'language' as const, title: 'Sprache', hint: 'Deutsch', content: <section id="language-settings"><p>Sprachwahl</p></section> },
  ]
  it('opens a tile as its own page and keeps the danger zone apart', () => {
    render(<ProfileSettings lang="de" sections={sections} danger={<button type="button">Zurücksetzen</button>} />)
    expect(screen.getByRole('heading', { name: t('settings_danger') })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Meine Daten/ }))
    expect(screen.getByText('Formular')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zurücksetzen' })).not.toBeInTheDocument()
  })
  it('follows the old link to the language settings', () => {
    window.history.replaceState(null, '', '/de/dashboard/profile#language-settings')
    render(<ProfileSettings lang="de" sections={sections} danger={null} />)
    expect(screen.getByText('Sprachwahl')).toBeInTheDocument()
    window.history.replaceState(null, '', '/')
  })
})

describe('Erfolgs-Momente', () => {
  it('shows where the cards of a session went', () => {
    render(<SessionBoxMoves lang="de" moves={[{ from: 1, to: 2, learned: false }, { from: 2, to: 3, learned: false }, { from: 3, to: 2, learned: false }, { from: 6, to: 6, learned: true }]} />)
    expect(screen.getByText('3 Karten eine Stufe höher')).toBeInTheDocument()
    expect(screen.getByText('1 Karte zurück zum Wiederholen')).toBeInTheDocument()
    expect(screen.getByText('1 Karte sicher gelernt')).toBeInTheDocument()
  })
  it('turns the assessment into a picture of two filled boxes', () => {
    render(<AssessmentResult lang="de" known={32} fresh={52} />)
    expect(screen.getByText('32 von 84 Wörtern kennst du schon')).toBeInTheDocument()
    expect(screen.getByText('Neu in Fach 1: 52')).toBeInTheDocument()
  })
})

describe('Übersetzungen', () => {
  it('have every key with the same placeholders in all five languages', () => {
    const keys = Object.keys(STUDENT_MESSAGES.de)
    for (const messages of Object.values(STUDENT_MESSAGES)) {
      expect(Object.keys(messages).sort()).toEqual([...keys].sort())
      for (const key of keys) {
        const text = messages[key as keyof typeof messages]
        expect(text.trim().length).toBeGreaterThan(0)
        const placeholders = (value: string) => (value.match(/\{\w+\}/g) ?? []).sort()
        // Einzahl-Varianten dürfen die Zahl ausschreiben.
        if (!key.endsWith('_one')) expect(placeholders(text)).toEqual(placeholders(STUDENT_MESSAGES.de[key as keyof typeof messages]))
      }
    }
  })
})
