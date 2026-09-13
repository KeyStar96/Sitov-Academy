import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import NextMonthBookings from '@/components/admin/NextMonthBookings'
import BlackboardEditor from '@/components/admin/BlackboardEditor'
import { AdminI18nProvider } from '@/components/admin/AdminI18nProvider'
import { BlackboardProvider } from '@/components/admin/BlackboardProvider'
import { saveBlackboardNote } from '@/app/actions/teacher-notes'
import type { NextMonthOverview } from '@/lib/types/admin-staff'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'

jest.unmock('lucide-react')
jest.mock('@/app/actions/teacher-notes', () => ({ saveBlackboardNote: jest.fn() }))

const student = '00000000-0000-4000-8000-000000000001'
const course = '00000000-0000-4000-8000-0000000000aa'
const overview: NextMonthOverview = {
  targetMonth: '2026-10-01',
  enrolledCount: 1,
  paused: [],
  groups: [{
    courseId: course, title: 'B1.2 Intensiv', type: 'presence',
    students: [{
      student: { id: student, person: { display_name: 'Anna', email: 'anna@example.invalid', phone: '+49 111', street: 'Weg 1', postal_code: '30159', city: 'Hannover' } },
      courseSelections: [{ courseId: course, requestedUnits: undefined }], source: 'booking', status: 'pending', note: null,
    }],
  }],
}

function renderBoard(translations = de.admin) {
  return render(
    <AdminI18nProvider translations={translations}>
      <BlackboardProvider initialNotes={{}}>
        <NextMonthBookings overview={overview} lang="de" courseTitles={{ [course]: 'B1.2 Intensiv' }} />
      </BlackboardProvider>
    </AdminI18nProvider>
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(saveBlackboardNote).mockResolvedValue({
    success: true,
    data: { id: course, student_id: student, teacher_id: student, note_text: 'Stammkunde', created_at: '2026-01-01', updated_at: '2026-01-01' },
  })
})

it.each([['de', de], ['en', en], ['ru', ru], ['uk', uk], ['tr', tr]] as const)('renders the booking grid and blackboard labels in %s', (lang, dict) => {
  render(
    <AdminI18nProvider translations={dict.admin}>
      <BlackboardProvider initialNotes={{}}>
        <NextMonthBookings overview={overview} lang={lang} courseTitles={{ [course]: 'B1.2 Intensiv' }} />
      </BlackboardProvider>
    </AdminI18nProvider>
  )
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(screen.getAllByText('B1.2 Intensiv').length).toBeGreaterThan(0)
  expect(screen.getAllByText(dict.admin.blackboard_title).length).toBeGreaterThan(0)
  expect(screen.getAllByLabelText(`${dict.admin.blackboard_note_label}: Anna`).length).toBeGreaterThan(0)
})

it('shows contact details and autosaves blackboard edits', async () => {
  jest.useFakeTimers()
  renderBoard()
  expect(screen.getAllByText('+49 111', { exact: false }).length).toBeGreaterThan(0)
  fireEvent.change(screen.getAllByLabelText(`${de.admin.blackboard_note_label}: Anna`)[0], { target: { value: 'Stammkunde' } })
  expect(screen.queryByLabelText(`${de.admin.blackboard_discount_label}: Anna`)).not.toBeInTheDocument()
  expect(saveBlackboardNote).not.toHaveBeenCalled()
  await act(async () => { jest.advanceTimersByTime(800) })
  await waitFor(() => expect(saveBlackboardNote).toHaveBeenCalled())
  expect(jest.mocked(saveBlackboardNote).mock.calls.at(-1)?.[0]).toMatchObject({
    student_id: student, note_text: 'Stammkunde',
  })
  jest.useRealTimers()
})

it('keeps the latest optimistic note visible while saving', async () => {
  jest.useFakeTimers()
  render(
    <AdminI18nProvider translations={de.admin}>
      <BlackboardProvider initialNotes={{}}>
        <BlackboardEditor studentId={student} studentName="Anna" />
      </BlackboardProvider>
    </AdminI18nProvider>
  )
  const field = screen.getByLabelText(`${de.admin.blackboard_note_label}: Anna`)
  fireEvent.change(field, { target: { value: 'Erste Notiz' } })
  expect(field).toHaveValue('Erste Notiz')
  await act(async () => { jest.advanceTimersByTime(800) })
  await waitFor(() => expect(saveBlackboardNote).toHaveBeenCalled())
  jest.useRealTimers()
})

it('updates the existing central note without obsolete billing fields', async () => {
  jest.useFakeTimers()
  render(<AdminI18nProvider translations={de.admin}>
    <BlackboardProvider initialNotes={{ [student]: { id: course, student_id: student, teacher_id: student, note_text: 'Vorhanden', created_at: '2026-01-01', updated_at: '2026-01-01' } }}>
      <BlackboardEditor studentId={student} studentName="Anna" />
    </BlackboardProvider>
  </AdminI18nProvider>)
  expect(screen.queryByLabelText(`${de.admin.blackboard_discount_label}: Anna`)).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText(`${de.admin.blackboard_note_label}: Anna`), { target: { value: 'Neue Notiz' } })
  await act(async () => { jest.advanceTimersByTime(800) })
  await waitFor(() => expect(saveBlackboardNote).toHaveBeenCalledWith(expect.objectContaining({ note_text: 'Neue Notiz' })))
  jest.useRealTimers()
})

it('preserves the latest note after a rejected save and allows retry', async () => {
  jest.useFakeTimers()
  jest.mocked(saveBlackboardNote).mockRejectedValueOnce(new Error('offline'))
  render(<AdminI18nProvider translations={de.admin}><BlackboardProvider initialNotes={{}}><BlackboardEditor studentId={student} studentName="Anna" /></BlackboardProvider></AdminI18nProvider>)
  const field = screen.getByLabelText(`${de.admin.blackboard_note_label}: Anna`)
  fireEvent.change(field, { target: { value: 'Diese Notiz behalten' } })
  await act(async () => { jest.advanceTimersByTime(800) })
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(de.admin.blackboard_save_failed))
  expect(field).toHaveValue('Diese Notiz behalten')
  fireEvent.click(screen.getByRole('button', { name: de.admin.access_retry }))
  await act(async () => { jest.advanceTimersByTime(800) })
  await waitFor(() => expect(saveBlackboardNote).toHaveBeenCalledTimes(2))
  expect(jest.mocked(saveBlackboardNote).mock.calls[1][0]).toMatchObject({ note_text: 'Diese Notiz behalten' })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  jest.useRealTimers()
})
