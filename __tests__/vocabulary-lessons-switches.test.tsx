import { act, fireEvent, render, screen, within } from '@testing-library/react'
import VocabularyLessons, { type LessonsNext } from '@/components/vocabulary/VocabularyLessons'
import { initializeLesson, setLessonInBox } from '@/app/actions/vocabulary'
import { toStations } from '@/lib/lesson-stations'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { OWN_WORDS_LESSON } from '@/lib/vocabulary-own-words'
import type { LessonStation } from '@/lib/learning-status-server'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
jest.mock('@/app/actions/vocabulary', () => ({ initializeLesson: jest.fn(), setLessonInBox: jest.fn() }))
jest.mock('@/components/vocabulary/LessonCardsModal', () => ({ __esModule: true, default: ({ lesson }: { lesson: string }) => <p>cards:{lesson}</p> }))
const mockPush = jest.fn()
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush, refresh: mockRefresh }) }))

const t = studentTranslator('de')
const vocabularyHref = '/de/dashboard/level/A1.1/vocabulary'

/** Begonnen und eingeschaltet, heute 5 Wörter fällig. */
const active: LessonStation = { lesson: 'Lektion 1', total: 10, active: 8, learned: 2, untouched: 0, due: 5 }
/** Begonnen, aber unter „Lektionen" ausgeschaltet. */
const paused: LessonStation = { lesson: 'Lektion 2', total: 12, active: 12, learned: 0, untouched: 0, due: 4, paused: true }
/** Noch nie begonnen. */
const fresh: LessonStation = { lesson: 'Lektion 3', total: 9, active: 0, learned: 0, untouched: 9, due: 0 }
const emptyOwn: LessonStation = { lesson: OWN_WORDS_LESSON, total: 0, active: 0, learned: 0, untouched: 0, due: 0 }

function mount({ lessons = [active, paused, fresh], own = emptyOwn, next = null }: { lessons?: LessonStation[]; own?: LessonStation; next?: LessonsNext | null } = {}) {
  return render(<VocabularyLessons lang="de" level="A1.1" stations={toStations(lessons, lesson => lesson)}
    next={next} vocabularyHref={vocabularyHref} vocabularyTranslations={de.vocabulary} ownWords={own} />)
}

const lessonSwitch = (lesson: string) => screen.getByRole('switch', { name: t('switch_aria', { lesson }) })

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(setLessonInBox).mockResolvedValue({ success: true })
  jest.mocked(initializeLesson).mockResolvedValue({ success: true, added: 9 })
})

it('zeigt an jeder Lektion klar, ob sie in der Lernbox liegt', () => {
  mount()
  expect(lessonSwitch('Lektion 1')).toHaveAttribute('aria-checked', 'true')
  expect(lessonSwitch('Lektion 1')).toHaveTextContent(t('switch_on'))
  expect(lessonSwitch('Lektion 2')).toHaveAttribute('aria-checked', 'false')
  expect(lessonSwitch('Lektion 2')).toHaveTextContent(t('switch_hint_resume'))
  expect(lessonSwitch('Lektion 3')).toHaveTextContent(t('switch_hint_start'))
  // Fällig zählt nur, was auch geübt wird.
  expect(screen.getByText(t('station_due', { count: 5 }))).toBeInTheDocument()
  expect(screen.queryByText(t('station_due', { count: 4 }))).not.toBeInTheDocument()
})

it('nimmt eine Lektion heraus und legt sie wieder hinein, ohne nachzufragen', async () => {
  mount()
  await act(async () => { fireEvent.click(lessonSwitch('Lektion 1')) })
  expect(setLessonInBox).toHaveBeenCalledWith('Lektion 1', 'A1.1', false)
  expect(lessonSwitch('Lektion 1')).toHaveAttribute('aria-checked', 'false')
  await act(async () => { fireEvent.click(lessonSwitch('Lektion 2')) })
  expect(setLessonInBox).toHaveBeenCalledWith('Lektion 2', 'A1.1', true)
  expect(lessonSwitch('Lektion 2')).toHaveAttribute('aria-checked', 'true')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(mockRefresh).toHaveBeenCalled()
})

it('stellt den Schalter zurück und sagt Bescheid, wenn das Speichern scheitert', async () => {
  jest.mocked(setLessonInBox).mockResolvedValue({ success: false })
  mount()
  await act(async () => { fireEvent.click(lessonSwitch('Lektion 1')) })
  expect(lessonSwitch('Lektion 1')).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('alert')).toHaveTextContent(t('switch_failed'))
})

describe('erstes Einschalten einer Lektion', () => {
  it('fragt einmal: Wörter prüfen oder alle in Fach 1', async () => {
    mount()
    fireEvent.click(lessonSwitch('Lektion 3'))
    const dialog = screen.getByRole('dialog', { name: t('start_title', { lesson: 'Lektion 3' }) })
    expect(within(dialog).getByText(t('start_question'))).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: new RegExp(t('start_assess')) })).toBeInTheDocument()
    expect(setLessonInBox).not.toHaveBeenCalled()
    expect(initializeLesson).not.toHaveBeenCalled()
  })

  it('legt auf Wunsch alle Wörter ohne Einstufung in Fach 1', async () => {
    mount()
    fireEvent.click(lessonSwitch('Lektion 3'))
    const dialog = screen.getByRole('dialog')
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(t.count('start_all', 9)) })) })
    expect(initializeLesson).toHaveBeenCalledWith('Lektion 3', 'A1.1')
    expect(lessonSwitch('Lektion 3')).toHaveAttribute('aria-checked', 'true')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('führt zur Einstufung der Lektion', async () => {
    mount()
    fireEvent.click(lessonSwitch('Lektion 3'))
    await act(async () => { fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: new RegExp(t('start_assess')) })) })
    expect(setLessonInBox).toHaveBeenCalledWith('Lektion 3', 'A1.1', true)
    expect(mockPush).toHaveBeenCalledWith(`${vocabularyHref}/assess?lesson=Lektion%203`)
  })

  it('bleibt offen und meldet den Fehler, wenn die Wörter nicht gespeichert werden', async () => {
    jest.mocked(initializeLesson).mockResolvedValue({ success: false, added: 0 })
    mount()
    fireEvent.click(lessonSwitch('Lektion 3'))
    await act(async () => { fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: new RegExp(t.count('start_all', 9)) })) })
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent(t('start_failed'))
    expect(lessonSwitch('Lektion 3')).toHaveAttribute('aria-checked', 'false')
  })

  it('startet auch über den großen Weiter-Knopf mit derselben Frage', () => {
    mount({ next: { lesson: 'Lektion 3', hint: t('lessons_next_lesson', { lesson: 'Lektion 3' }) } })
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('lessons_continue')) }))
    expect(screen.getByRole('dialog', { name: t('start_title', { lesson: 'Lektion 3' }) })).toBeInTheDocument()
  })
})

describe('Eigene Wörter unter „Lektionen“', () => {
  it('lädt ohne Wort zum ersten Eintrag ein; der Schalter ist gesperrt', () => {
    mount()
    const own = lessonSwitch(de.vocabulary.own_words_title)
    expect(own).toBeDisabled()
    expect(own).toHaveTextContent(de.vocabulary.own_words_switch_disabled)
    fireEvent.click(screen.getByRole('button', { name: de.vocabulary.own_words_add_first }))
    expect(screen.getByText(`cards:${OWN_WORDS_LESSON}`)).toBeInTheDocument()
  })

  it('legt beim Einschalten alle eigenen Wörter ohne Einstufung in Fach 1', async () => {
    mount({ own: { ...emptyOwn, total: 3, untouched: 3 } })
    await act(async () => { fireEvent.click(lessonSwitch(de.vocabulary.own_words_title)) })
    expect(initializeLesson).toHaveBeenCalledWith(OWN_WORDS_LESSON, 'A1.1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(lessonSwitch(de.vocabulary.own_words_title)).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: t('own_edit') })).toBeInTheDocument()
  })
})
