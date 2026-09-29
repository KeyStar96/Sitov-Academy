import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Attendance, { attendanceCandidates } from '@/components/admin/certificates/Attendance'
import { certificateAdminCopy } from '@/components/admin/certificates/i18n'
import type { CertificateAdminData } from '@/lib/certificates/types'

const personId = '00000000-0000-4000-8000-000000000001'
const courseId = '00000000-0000-4000-8000-000000000002'
const bookingId = '00000000-0000-4000-8000-000000000003'
const itemId = '00000000-0000-4000-8000-000000000004'
const periodId = '00000000-0000-4000-8000-000000000005'
function fixture(): CertificateAdminData {
  return {
    batches: [], customers: [], products: [], productCourses: [], invoices: [], invoiceRelations: [], allocations: [], periods: [], issues: [],
    people: [{ id: personId, display_name: 'Test Student', email: 'student@example.test', street: null, postal_code: null, city: null }],
    courses: [{ id: courseId, title: 'Deutsch B1', description: 'Current course content', slug: 'deutsch-b1', start_date: '2026-09-08', end_date: null, archived_at: null, type: 'online' }],
    bookings: [{ id: bookingId, person_id: personId, target_month: '2026-09-01', start_date: '2026-09-10', status: 'confirmed', kind: 'monthly' }],
    bookingItems: [{ id: itemId, booking_id: bookingId, course_id: courseId, title_snapshot: 'Booked B1 course' }],
    schedules: [{ course_id: courseId, weekday: 2, start_time: '14:30:00', end_time: '15:30:00' }],
  }
}
function confirmedPeriod(): CertificateAdminData['periods'][number] {
  return { id: periodId, person_id: personId, course_id: courseId, start_date: '2026-09-10', end_date: '2026-09-20',
    status: 'confirmed', confirmed_at: '2026-09-20T16:00:00Z', title_snapshot: 'Historical B1', description_snapshot: 'Historical content',
    schedule_snapshot: [{ weekday: 1, start_time: '09:00:00', end_time: '10:00:00' }], revision: 3, source_revision: 3 }
}

beforeEach(() => jest.useFakeTimers({ now: new Date('2026-09-29T12:00:00Z') }))
afterEach(() => jest.useRealTimers())

it('suggests only the actual course/booking intersection through today for explicit teacher confirmation', () => {
  const data = fixture()
  const result = attendanceCandidates(data, '2026-09', '', '2026-09-29')
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({ person_id: personId, course_id: courseId, start: '2026-09-10', end: '2026-09-29' })
  data.courses[0].start_date = '2026-09-15'
  data.courses[0].end_date = '2026-09-22'
  expect(attendanceCandidates(data, '2026-09', '', '2026-09-29')[0]).toMatchObject({ start: '2026-09-15', end: '2026-09-22' })
})

it('does not infer attendance for cancelled/trial bookings, future periods or another selected course', () => {
  const data = fixture()
  data.bookings[0].status = 'cancelled'
  expect(attendanceCandidates(data, '2026-09', '', '2026-09-29')).toEqual([])
  data.bookings[0].status = 'confirmed'; data.bookings[0].kind = 'trial'
  expect(attendanceCandidates(data, '2026-09', '', '2026-09-29')).toEqual([])
  data.bookings[0].kind = 'monthly'
  expect(attendanceCandidates(data, '2026-09', 'another-course', '2026-09-29')).toEqual([])
  expect(attendanceCandidates(data, '2026-10', '', '2026-09-29')).toEqual([])
})

it('does not fill historical gaps or recreate revoked attendance from a monthly booking', () => {
  const data = fixture()
  data.periods = [confirmedPeriod()]
  expect(attendanceCandidates(data, '2026-09', '', '2026-09-29')).toEqual([])
  data.periods[0].status = 'revoked'
  expect(attendanceCandidates(data, '2026-09', '', '2026-09-29')).toEqual([])
})

it('preserves existing pending wording and revision while capping a month-end suggestion to today', () => {
  const data = fixture()
  data.periods = [{ ...confirmedPeriod(), status: 'pending', confirmed_at: null, end_date: '2026-09-30' }]
  const rows = attendanceCandidates(data, '2026-09', '', '2026-09-29')
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ id: periodId, revision: 3, title: 'Historical B1', description: 'Historical content', end: '2026-09-29',
    schedule: [{ weekday: 1, start_time: '09:00', end_time: '10:00' }] })
  expect(data.periods[0].end_date).toBe('2026-09-30')
})

it('keeps bulk confirmation disabled until a teacher selects attendance and submits the corrected dates', async () => {
  const data = fixture()
  data.periods = [{ ...confirmedPeriod(), status: 'pending', confirmed_at: null, end_date: '2026-09-30' }]
  const run = jest.fn().mockResolvedValue(true)
  render(<Attendance data={data} lang="de" c={certificateAdminCopy('de')} busy={false} run={run} />)
  const confirm = screen.getByRole('button', { name: /Ausgewählte Teilnahme bestätigen/ })
  expect(confirm).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox', { name: /Test Student/ }))
  expect(confirm).toBeEnabled()
  fireEvent.change(screen.getAllByLabelText('Beginn')[0], { target: { value: '2026-09-12' } })
  fireEvent.click(confirm)
  await waitFor(() => expect(run).toHaveBeenCalledWith({ command: 'confirm_participation', payload: { periods: [expect.objectContaining({
    id: periodId, revision: 3, person_id: personId, course_id: courseId, start: '2026-09-12', end: '2026-09-29',
    title: 'Historical B1', description: 'Historical content', schedule: [{ weekday: 1, start_time: '09:00', end_time: '10:00' }],
  })] } }))
  await waitFor(() => expect(confirm).toBeDisabled())
})
