import React from 'react'
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import TeacherStudentPath, { teacherAnswerText } from '@/components/admin/TeacherStudentPath'
import TeacherStudentOverview from '@/components/admin/TeacherStudentOverview'
import StudentList from '@/components/admin/StudentList'
import { AdminI18nProvider } from '@/components/admin/AdminI18nProvider'
import { interveneTeacherPath } from '@/app/actions/teacher-dashboard'
import { updateStudentAllowedLevels } from '@/app/actions/admin'
import type { TeacherDetailData, TeacherStudent } from '@/lib/teacher-dashboard-contract'
import de from '@/dictionaries/de.json'

jest.mock('@/app/actions/teacher-dashboard', () => ({ interveneTeacherPath: jest.fn() }))
jest.mock('@/app/actions/admin', () => ({ updateStudentAllowedLevels: jest.fn(), updateStudentTrainerAccess: jest.fn(), updateStudentRole: jest.fn(), resetStudentProgress: jest.fn() }))
const id = '00000000-0000-4000-8000-000000000001', unitId = '00000000-0000-4000-8000-000000000002', nodeId = '00000000-0000-4000-8000-000000000003'
const requestId = '00000000-0000-4000-8000-000000000004'
const student: TeacherStudent = { id, role: 'student', created_at: null, person: { display_name: 'Ada', email: 'ada@example.test', phone: null, street: null, postal_code: null, city: null }, allowed_levels: ['A1.1'], trainer_grants: [], lastActiveAt: '2026-09-25T22:30:00Z', learningSeconds7d: 600, learningSeconds30d: 900, streakDays: 2, currentLevel: 'A1.1', pathPosition: null, lastTest: null, dueCards: 3, phases: { '1': 3, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, learned: 0 }, attentionReasons: [], completedPathsByLevel: [] }
const data: TeacherDetailData['path'] = { paths: [{ id: unitId, level: 'A1.1', title: 'Familie', available: false, completed: false, nodes: [{ id: nodeId, title: 'Test 1', kind: 'test', available: false, status: null, stars: 0, sort_order: 1 }] }], attempts: [], interventions: [] }
const mountPath = (canIntervene = true) => render(<AdminI18nProvider translations={de.admin}><TeacherStudentPath data={data} studentId={id} studentName="Ada" lang="de" canIntervene={canIntervene} /></AdminI18nProvider>)
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  Object.defineProperty(global.crypto, 'randomUUID', { value: () => requestId, configurable: true })
})
beforeEach(() => jest.clearAllMocks())
it('requires confirmation with the exact student and path and cancellation performs no write', () => {
  mountPath()
  fireEvent.click(screen.getByRole('button', { name: 'Pfad freischalten' }))
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveTextContent('Ada')
  expect(dialog).toHaveTextContent('Familie')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }))
  expect(interveneTeacherPath).not.toHaveBeenCalled()
})
it('keeps the request id across a failed retry and blocks duplicate clicks while pending', async () => {
  let finish: (value: { error: string }) => void = () => {}
  jest.mocked(interveneTeacherPath).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  mountPath()
  fireEvent.click(screen.getByRole('button', { name: 'Test zurücksetzen' }))
  fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))
  fireEvent.click(screen.getByRole('button', { name: 'Wird gespeichert …' }))
  expect(interveneTeacherPath).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeDisabled()
  await act(async () => finish({ error: 'learning_reset_in_progress' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Ein Zurücksetzen läuft bereits')
  jest.mocked(interveneTeacherPath).mockResolvedValueOnce({ data: { success: true } })
  fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(interveneTeacherPath).toHaveBeenNthCalledWith(1, { studentId: id, unitId, nodeId, action: 'reset_test', requestId })
  expect(interveneTeacherPath).toHaveBeenNthCalledWith(2, { studentId: id, unitId, nodeId, action: 'reset_test', requestId })
  expect(screen.getByRole('status')).toHaveTextContent('Eingriff ausgeführt und protokolliert')
})
it('hides interventions on a staff profile', () => {
  mountPath(false)
  expect(screen.queryByRole('button', { name: 'Pfad freischalten' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Test zurücksetzen' })).not.toBeInTheDocument()
})
it('formats exact typed answers and resolves choice and sentence indices against frozen prompts', () => {
  expect(teacherAnswerText({ text: '  WOHNE!!  ' })).toBe('  WOHNE!!  ')
  expect(teacherAnswerText({ index: 1 }, { type: 'multiple_choice', content: { options: ['Ich', 'Du'] } })).toBe('Du')
  expect(teacherAnswerText({ indices: [2, 0, 1] }, { type: 'sentence_building', content: { parts: ['wohne', 'hier.', 'Ich'] } })).toBe('Ich wohne hier.')
  expect(teacherAnswerText({ content: { text_before: 'Ich', text_after: 'hier.', instruction: 'Ergänze.' } })).toBe('Ich … hier.')
})
it('links to the dedicated student page and filters dates in Berlin consistently', () => {
  render(<AdminI18nProvider translations={de.admin}><StudentList initialStudents={[student]} lang="de" /></AdminI18nProvider>)
  expect(screen.getByRole('link', { name: /Ada/  })).toHaveAttribute('href', `/de/admin/students/${id}`)
  fireEvent.click(screen.getByText('Spaltenfilter'))
  fireEvent.change(screen.getByLabelText('Zuletzt aktiv · Ab Datum'), { target: { value: '2026-09-26' } })
  expect(screen.getByTestId(`teacher-student-${id}`)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Fällige Karten · Mindestens'), { target: { value: '4' } })
  expect(screen.queryByTestId(`teacher-student-${id}`)).not.toBeInTheDocument()
})
it('unlocks every level together with a single authoritative update', async () => {
  jest.mocked(updateStudentAllowedLevels).mockResolvedValue({ success: true, allowedLevels: ['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2'] })
  render(<AdminI18nProvider translations={de.admin}><TeacherStudentOverview student={student} lang="de" currentUserId={nodeId} currentUserRole="teacher" /></AdminI18nProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Alle Niveaus auswählen' }))
  expect(updateStudentAllowedLevels).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Ausgewählte Niveaus speichern' }))
  await waitFor(() => expect(updateStudentAllowedLevels).toHaveBeenCalledWith(id, ['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2']))
})
