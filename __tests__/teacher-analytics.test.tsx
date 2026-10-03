import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import TeacherAnalytics from '@/components/admin/TeacherAnalytics'
import { getStudentLearningProgress } from '@/app/actions/learning-progress'
import { teacherAnalyticsCopy } from '@/lib/teacher-analytics-i18n'
import { progressData, progressDay, progressStudentId as studentId } from './fixtures/learning-progress'

jest.unmock('lucide-react')
jest.mock('@/app/actions/learning-progress', () => ({ getStudentLearningProgress: jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))
const secondId = '00000000-0000-4000-8000-000000000002'
const options = { students: [{ id: studentId, name: 'Anna' }, { id: secondId, name: 'Boris' }], levels: [{ code: 'A1.1' }, { code: 'A1.2' }] }
// Heute: 10 Lernbox-Antworten (8 richtig) + 2 Problemwörter (1 richtig) + 4 Lernpfad (3 richtig) = 16, davon 12 richtig = 75 %.
const data = progressData(7, '2026-09-30', (day, index) => index === 6
  ? progressDay(day.date, { vocabulary: { answers: 10, correct: 8, seconds: 600 }, focus: { answers: 2, correct: 1 }, path: { answers: 4, correct: 3, stations: 1 } })
  : index === 5 ? progressDay(day.date, { vocabulary: { answers: 10, correct: 5 } }) : day)
beforeEach(() => { jest.clearAllMocks(); jest.mocked(getStudentLearningProgress).mockResolvedValue({ success: true, data }) })

it('shows today’s answered and correct questions with a percentage and the daily table', async () => {
  render(<TeacherAnalytics options={options} failed={false} lang="de" translations={{}} />)
  const today = await screen.findByRole('region', { name: 'Heute' })
  expect(within(today).getByRole('img', { name: '75 Prozent richtig' })).toBeInTheDocument()
  expect(within(today).getByText('16')).toBeInTheDocument()
  expect(within(today).getByText('12')).toBeInTheDocument()
  expect(within(today).getByText('Ø Vortage: 50 %')).toBeInTheDocument()
  expect(within(today).getByText('10 Min.')).toBeInTheDocument()
  expect(getStudentLearningProgress).toHaveBeenCalledWith({ studentId, level: null, days: 30 })
  fireEvent.click(screen.getByText('Tageswerte anzeigen', { selector: 'summary' }))
  const table = screen.getByRole('table', { name: 'Tageswerte anzeigen' })
  expect(within(table).getByRole('row', { name: /^30\.09\. 16 0 12 75 %/ })).toBeInTheDocument()
  expect(within(table).getByRole('row', { name: /^29\.09\. 10 0 5 50 %/ })).toBeInTheDocument()
  expect(within(table).getByRole('row', { name: /^28\.09\. 0 0 0 –/ })).toBeInTheDocument()
  // Kursverwaltung ist aus der Lernanalyse herausgelöst (Bereich „Kurse“).
  expect(screen.queryByRole('link', { name: /Kurse/ })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Schülerprofil öffnen' })).toHaveAttribute('href', `/de/admin/students/${studentId}`)
})

it('breaks progress down by learning mode in separate tabs', async () => {
  render(<TeacherAnalytics options={options} failed={false} lang="de" translations={{}} />)
  const tabs = await screen.findByRole('tablist', { name: 'Lernmodus wählen' })
  expect(within(tabs).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Vokabeltrainer', 'Verbtrainer', 'Lernpfad', 'Aussprache-Trainer', 'Mediathek'])
  expect(screen.getByRole('region', { name: 'Problemwörter' })).toHaveTextContent('Artikel falsch: 2')
  expect(screen.getByRole('region', { name: 'Leitner-Phasen 1–7' })).toBeInTheDocument()
  fireEvent.click(within(tabs).getByRole('tab', { name: 'Lernpfad' }))
  expect(within(tabs).getByRole('tab', { name: 'Lernpfad' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('region', { name: 'Tests im Zeitraum' })).toHaveTextContent('Artikel-Test')
  expect(screen.getByText('6 von 20')).toBeInTheDocument()
  fireEvent.keyDown(tabs, { key: 'ArrowRight' })
  expect(screen.getByText('3 von 10')).toBeInTheDocument()
  fireEvent.keyDown(tabs, { key: 'End' })
  expect(screen.getByRole('region', { name: 'Zuletzt angesehen' })).toHaveTextContent('Begrüßung')
  expect(screen.getByText('2 von 8')).toBeInTheDocument()
})

it('switches the period and trainer level and never lets a slow old response win', async () => {
  let resolveFirst!: (result: Awaited<ReturnType<typeof getStudentLearningProgress>>) => void
  jest.mocked(getStudentLearningProgress).mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve }))
    .mockResolvedValueOnce({ success: true, data: { ...data, studentId: secondId, focus: { ...data.focus, active: 9 } } })
  render(<TeacherAnalytics options={options} failed={false} lang="de" translations={{}} />)
  fireEvent.change(screen.getByLabelText('Schüler'), { target: { value: secondId } })
  const focus = await screen.findByRole('region', { name: 'Problemwörter' })
  expect(within(focus).getByText('9')).toBeInTheDocument()
  await act(async () => resolveFirst({ success: true, data }))
  expect(within(screen.getByRole('region', { name: 'Problemwörter' })).getByText('9')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '90 Tage' }))
  await waitFor(() => expect(getStudentLearningProgress).toHaveBeenLastCalledWith({ studentId: secondId, level: null, days: 90 }))
  expect(screen.getByRole('button', { name: '90 Tage' })).toHaveAttribute('aria-pressed', 'true')
  const selector = screen.getByLabelText('Trainer-Niveau')
  expect(within(selector).getAllByRole('option').map(option => option.textContent)).toEqual(['Alle Lernniveaus', 'A1.1', 'A1.2'])
  fireEvent.change(selector, { target: { value: 'A1.1' } })
  expect(await screen.findByText(/Kursanmeldungen und Kurszuordnungen sind davon unabhängig/)).toBeInTheDocument()
  await waitFor(() => expect(getStudentLearningProgress).toHaveBeenLastCalledWith({ studentId: secondId, level: 'A1.1', days: 90 }))
})

it('preselects the student from the profile link', async () => {
  render(<TeacherAnalytics options={options} failed={false} lang="de" translations={{}} initialStudentId={secondId} initialDays={7} />)
  await waitFor(() => expect(getStudentLearningProgress).toHaveBeenCalledWith({ studentId: secondId, level: null, days: 7 }))
  expect(screen.getByLabelText('Schüler')).toHaveValue(secondId)
})

it('shows an explicit error and retries instead of presenting an outage as zero progress', async () => {
  jest.mocked(getStudentLearningProgress).mockResolvedValueOnce({ success: false, error: 'request_failed' })
  render(<TeacherAnalytics options={options} failed={false} lang="de" translations={{}} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Die Lernanalyse konnte nicht geladen werden')
  expect(screen.queryByRole('region', { name: 'Heute' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }))
  expect(await screen.findByRole('region', { name: 'Heute' })).toBeInTheDocument()
})

it('does not request learning data when metadata loading failed', async () => {
  render(<TeacherAnalytics options={{ students: [], levels: [] }} failed lang="de" translations={{}} />)
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  expect(getStudentLearningProgress).not.toHaveBeenCalled()
})

it('keeps all five localizations complete', () => {
  for (const lang of ['de', 'en', 'ru', 'uk', 'tr']) {
    expect(Object.keys(teacherAnalyticsCopy(lang))).toEqual(Object.keys(teacherAnalyticsCopy('de')))
    expect(Object.values(teacherAnalyticsCopy(lang)).every(value => value.trim().length > 0)).toBe(true)
  }
})
