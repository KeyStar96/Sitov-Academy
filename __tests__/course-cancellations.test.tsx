import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import CourseCancellations from '@/components/admin/CourseCancellations'
import { AdminI18nProvider } from '@/components/admin/AdminI18nProvider'
import { cancelCourseDate, cancelWholeDay, restoreCancellation } from '@/app/actions/course-cancellations'
import { coursesOnDate, groupCancellations, isCalendarDate, isoWeekday, type CancellationCourse, type CancellationData } from '@/lib/course-cancellations'
import { courseCancellationsCopy } from '@/lib/course-cancellations-i18n'
import de from '@/dictionaries/de.json'

const refresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }), usePathname: () => '/de/admin/courses/cancellations' }))
jest.mock('@/app/actions/course-cancellations', () => ({ cancelCourseDate: jest.fn(), cancelWholeDay: jest.fn(), restoreCancellation: jest.fn() }))
jest.unmock('lucide-react')

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const course = (n: number, overrides: Partial<CancellationCourse> = {}): CancellationCourse => ({
  id: id(n), title: `Kurs ${n}`, type: 'online', category: 'german', level: 'A1', startDate: null, endDate: null, archived: false,
  schedules: [{ weekday: 1, start: '18:00', end: '19:30' }], ...overrides,
})
// 2099-10-05 ist ein Montag.
const MONDAY = '2099-10-05'
const data: CancellationData = {
  courses: [
    course(1),
    course(2, { title: 'Kurs Dienstag', schedules: [{ weekday: 2, start: '10:00', end: '11:00' }] }),
    course(3, { title: 'Archiviert', archived: true }),
    course(4, { title: 'Beendet', endDate: '2099-01-01' }),
    course(5, { title: 'Privat', category: 'private', schedules: [] }),
    course(6, { title: 'Montag spät', schedules: [{ weekday: 1, start: '20:00', end: '21:00' }, { weekday: 3, start: '20:00', end: '21:00' }] }),
  ],
  cancellations: [
    { id: id(90), date: '2099-12-24', reason: 'Weihnachten', courseId: null },
    { id: id(91), date: '2099-11-02', reason: 'Fortbildung', courseId: id(1) },
    { id: id(92), date: '2020-01-06', reason: 'Alt', courseId: id(2) },
  ],
}
const c = courseCancellationsCopy('de')
const renderPage = () => render(<AdminI18nProvider translations={de.admin}><CourseCancellations data={data} lang="de" /></AdminI18nProvider>)

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(cancelWholeDay).mockResolvedValue({ success: true, data: { results: [{ courseId: id(1), saved: true }, { courseId: id(6), saved: true }] } })
  jest.mocked(cancelCourseDate).mockResolvedValue({ success: true, data: { id: id(95) } })
  jest.mocked(restoreCancellation).mockResolvedValue({ success: true, data: { deleted: true } })
})

describe('calendar rules', () => {
  test('ISO weekdays and real calendar dates', () => {
    expect(isoWeekday(MONDAY)).toBe(1)
    expect(isoWeekday('2099-10-11')).toBe(7)
    expect(isCalendarDate('2026-02-30')).toBe(false)
    expect(isCalendarDate('2028-02-29')).toBe(true)
  })
  test('a whole day only affects active courses with a lesson on that weekday within their run', () => {
    expect(coursesOnDate(data.courses, MONDAY).map(item => item.title)).toEqual(['Kurs 1', 'Montag spät'])
  })
  test('upcoming ascending, past descending, whole-day entries first', () => {
    expect(groupCancellations(data.cancellations, '2099-01-01', 'upcoming').map(group => group.date)).toEqual(['2099-11-02', '2099-12-24'])
    expect(groupCancellations(data.cancellations, '2099-01-01', 'past').map(group => group.date)).toEqual(['2020-01-06'])
  })
})

test('whole day: preselects the courses running that weekday and saves them together', async () => {
  renderPage()
  fireEvent.change(screen.getByLabelText(c.date), { target: { value: MONDAY } })
  const boxes = screen.getAllByRole('checkbox')
  expect(boxes).toHaveLength(2)
  expect(boxes.every(box => (box as HTMLInputElement).checked)).toBe(true)
  expect(screen.getByRole('button', { name: c.submit })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: c.quickHoliday }))
  fireEvent.click(screen.getByRole('button', { name: c.submit }))
  await waitFor(() => expect(cancelWholeDay).toHaveBeenCalledWith({ date: MONDAY, reason: c.quickHoliday, courseIds: [id(1), id(6)] }))
  expect(await screen.findByRole('status')).toHaveTextContent('Kurs 1, Montag spät')
  expect(refresh).toHaveBeenCalled()
})

test('whole day: unchecked courses are left out and partial failures stay visible', async () => {
  jest.mocked(cancelWholeDay).mockResolvedValueOnce({ success: true, data: { results: [{ courseId: id(1), saved: false }] } })
  jest.mocked(cancelWholeDay).mockResolvedValueOnce({ success: true, data: { results: [{ courseId: id(1), saved: true }, { courseId: id(6), saved: false }] } })
  renderPage()
  fireEvent.change(screen.getByLabelText(c.date), { target: { value: MONDAY } })
  fireEvent.click(screen.getAllByRole('checkbox')[1])
  fireEvent.change(screen.getByPlaceholderText(c.reasonCustom), { target: { value: 'Krank' } })
  fireEvent.click(screen.getByRole('button', { name: c.submit }))
  await waitFor(() => expect(cancelWholeDay).toHaveBeenCalledWith({ date: MONDAY, reason: 'Krank', courseIds: [id(1)] }))
  expect(await screen.findByRole('alert')).toHaveTextContent(c.failed)
  fireEvent.click(screen.getAllByRole('checkbox')[1])
  fireEvent.click(screen.getByRole('button', { name: c.submit }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nicht gespeichert für: Montag spät')
})

test('single course: warns when the course has no lesson that day and saves the chosen course', async () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: c.modeCourse }))
  fireEvent.change(screen.getByLabelText(c.date), { target: { value: MONDAY } })
  const select = screen.getByLabelText(c.course)
  expect(within(select).queryByRole('option', { name: 'Archiviert' })).toBeNull()
  fireEvent.change(select, { target: { value: id(2) } })
  expect(screen.getByText(c.noLesson)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: c.quickTraining }))
  fireEvent.click(screen.getByRole('button', { name: c.submit }))
  await waitFor(() => expect(cancelCourseDate).toHaveBeenCalledWith({ courseId: id(2), date: MONDAY, reason: c.quickTraining }))
})

test('undoing a cancellation requires an explicit confirmation', async () => {
  renderPage()
  const list = screen.getByRole('region', { name: c.listTitle })
  expect(within(list).getByText(c.allCourses)).toBeInTheDocument()
  fireEvent.click(within(list).getAllByRole('button', { name: /Ausfall zurücknehmen/ })[0])
  expect(restoreCancellation).not.toHaveBeenCalled()
  fireEvent.click(within(list).getByRole('button', { name: c.keep }))
  expect(restoreCancellation).not.toHaveBeenCalled()
  fireEvent.click(within(list).getAllByRole('button', { name: /Ausfall zurücknehmen/ })[0])
  fireEvent.click(within(list).getByRole('button', { name: c.restoreYes }))
  await waitFor(() => expect(restoreCancellation).toHaveBeenCalledWith({ id: id(91) }))
  expect(await within(list).findByRole('status')).toHaveTextContent(c.restored)
})

test('past cancellations are available through the filter', () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: c.pastView }))
  expect(screen.getByText('Alt')).toBeInTheDocument()
  expect(screen.queryByText('Weihnachten')).not.toBeInTheDocument()
})
