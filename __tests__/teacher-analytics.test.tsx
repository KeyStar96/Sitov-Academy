import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import TeacherAnalytics from '@/components/admin/TeacherAnalytics'
import LearningHistoryChart from '@/components/admin/LearningHistoryChart'
import { getTeacherAnalytics } from '@/app/actions/teacher-analytics'
import { teacherAnalyticsSchema, type TeacherAnalytics as AnalyticsData } from '@/lib/teacher-analytics'
import { teacherAnalyticsCopy } from '@/lib/teacher-analytics-i18n'

jest.mock('@/app/actions/teacher-analytics', () => ({ getTeacherAnalytics: jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))
const studentId = '00000000-0000-4000-8000-000000000001', secondId = '00000000-0000-4000-8000-000000000002', courseId = '00000000-0000-4000-8000-000000000003'
const data: AnalyticsData = {
  studentId, courseId: null, level: null, completionByLevel: { 'A1.1': 50 }, timezone: 'Europe/Berlin',
  distribution: { buckets: [1, 2, 3, 4, 5, 6, 'learned'].map(key => ({ key, count: key === 6 ? 3 : 0 })) as AnalyticsData['distribution']['buckets'], totalCards: 3, totalInBox: 3, overallPercent: 86 },
  history: Array.from({ length: 30 }, (_, index) => ({ date: `2026-09-${String(index + 1).padStart(2, '0')}`, answers: index === 29 ? 5 : 0, correct: index === 29 ? 3 : 0 })),
}
const options = { students: [{ id: studentId, name: 'Anna' }, { id: secondId, name: 'Boris' }], courses: [{ id: courseId, title: 'Kurs A1', level: 'A1.1' }] }
beforeEach(() => { jest.clearAllMocks(); jest.mocked(getTeacherAnalytics).mockResolvedValue({ success: true, data }) })

it('renders server aggregates, accessible history, and the existing course/exception editor entry point', async () => {
  render(<TeacherAnalytics options={options} failed={false} lang="de" translations={{}} />)
  expect(await screen.findByRole('progressbar')).toHaveAttribute('aria-valuenow', '86')
  expect(screen.getByRole('link', { name: 'Kurse & Ausfälle verwalten' })).toHaveAttribute('href', '/de/admin/courses')
  fireEvent.click(screen.getByText('Tageswerte anzeigen'))
  const table = screen.getByRole('table')
  expect(within(table).getByRole('row', { name: '30.09. 5 3' })).toBeInTheDocument()
  expect(screen.getByText(/Tatsächlich gespeicherte Vokabelantworten/)).toBeInTheDocument()
})

it('does not let a slow previous selection overwrite a newer student response', async () => {
  let resolveFirst!: (result: Awaited<ReturnType<typeof getTeacherAnalytics>>) => void
  jest.mocked(getTeacherAnalytics).mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve }))
    .mockResolvedValueOnce({ success: true, data: { ...data, studentId: secondId, completionByLevel: { 'A1.1': 75 } } })
  render(<TeacherAnalytics options={options} failed={false} lang="de" translations={{}} />)
  fireEvent.change(screen.getByLabelText('Schüler'), { target: { value: secondId } })
  expect(await screen.findByText('75%')).toBeInTheDocument()
  await act(async () => resolveFirst({ success: true, data }))
  expect(screen.getByText('75%')).toBeInTheDocument(); expect(screen.queryByText('50%')).not.toBeInTheDocument()
})

it('shows an explicit error and retries instead of presenting a database outage as zero progress', async () => {
  jest.mocked(getTeacherAnalytics).mockResolvedValueOnce({ success: false, error: 'request_failed' })
  render(<TeacherAnalytics options={options} failed={false} lang="de" translations={{}} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Die Lernanalyse konnte nicht geladen werden')
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }))
  expect(await screen.findByRole('progressbar')).toBeInTheDocument()
})

it('sends course selection to SQL and distinguishes a missing level from empty learning progress', async () => {
  render(<TeacherAnalytics options={options} failed={false} lang="de" translations={{}} />)
  await screen.findByRole('progressbar')
  jest.mocked(getTeacherAnalytics).mockResolvedValueOnce({ success: true, data: { ...data, courseId, level: null } })
  fireEvent.change(screen.getByLabelText('Kurs'), { target: { value: courseId } })
  expect(await screen.findByText('Diesem Kurs ist kein eindeutiges Lernniveau zugeordnet.')).toBeInTheDocument()
  expect(getTeacherAnalytics).toHaveBeenLastCalledWith({ studentId, courseId })
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
})

it('does not draw a made-up learning curve when no receipts exist', () => {
  const { container } = render(<LearningHistoryChart lang="de" history={data.history.map(day => ({ ...day, answers: 0, correct: 0 }))} />)
  expect(screen.getByText('In diesem Zeitraum sind keine Vokabelantworten gespeichert.')).toBeInTheDocument()
  expect(container.querySelector('polyline')).toBeNull()
})

it('does not request learning data when metadata loading failed', async () => {
  render(<TeacherAnalytics options={{ students: [], courses: [] }} failed lang="de" translations={{}} />)
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  expect(getTeacherAnalytics).not.toHaveBeenCalled()
})

it('validates the aggregate contract and keeps all five localizations complete', () => {
  expect(teacherAnalyticsSchema.safeParse(data).success).toBe(true)
  expect(teacherAnalyticsSchema.safeParse({ ...data, distribution: { ...data.distribution, totalInBox: 0 } }).success).toBe(false)
  expect(teacherAnalyticsSchema.safeParse({ ...data, history: data.history.map(day => ({ ...day, correct: day.answers + 1 })) }).success).toBe(false)
  for (const lang of ['de', 'en', 'ru', 'uk', 'tr']) {
    expect(Object.keys(teacherAnalyticsCopy(lang))).toEqual(Object.keys(teacherAnalyticsCopy('de')))
    expect(Object.values(teacherAnalyticsCopy(lang)).every(value => value.trim().length > 0)).toBe(true)
  }
})
