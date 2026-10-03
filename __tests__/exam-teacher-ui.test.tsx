import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ExamTeacherPanel from '@/components/exam-preparation/ExamTeacherPanel'
import ExamAudioProductionPanel from '@/components/exam-preparation/ExamAudioProductionPanel'
import { EXAM_AUDIO_ORDERS, EXAM_MODULES, EXAM_RECORDING_SESSIONS } from '@/lib/exam-preparation/content'
import type { ExamSubmission } from '@/lib/exam-preparation/types'

jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('lucide-react', () => jest.requireActual('lucide-react'))
jest.mock('@/app/actions/exam-preparation', () => ({ reviewExamSubmission: jest.fn(), unlockExamModule: jest.fn(), assignExamTeacher: jest.fn() }))
jest.mock('@/app/actions/exam-audio-production', () => ({ createExamProductionUpload: jest.fn(), completeExamProductionUpload: jest.fn(), setExamProductionStatus: jest.fn() }))
jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))
import { reviewExamSubmission } from '@/app/actions/exam-preparation'

const task = EXAM_MODULES.flatMap(module => module.units.flatMap(unit => unit.tasks)).find(item => item.type === 'writing')!
const submission: ExamSubmission = { id: 'submission-1', taskId: task.id, taskVersion: task.version, unitId: 'unit-1', studentId: 'student-1', kind: 'writing', text: 'Guten Tag, ich möchte am Freitag kommen.', mediaPath: null, mediaUrl: null, teacherId: 'teacher-1', status: 'submitted', previousId: null, helped: false, reflection: 'Ich möchte meine Bitte deutlicher machen.', createdAt: '2026-10-03T10:00:00Z', feedback: [] }

test('teacher filters real submissions and retains the original and draft feedback on a failed save', async () => {
  jest.mocked(reviewExamSubmission).mockResolvedValue({ success: false, error: 'Bitte erneut speichern.' })
  const other = { ...submission, id: 'submission-2', studentId: 'student-2', kind: 'speaking' as const }
  render(<ExamTeacherPanel modules={EXAM_MODULES} state={{ success: true, actorRole: 'teacher', students: [{ id: 'student-1', name: 'Alex', course: 'B1 am Abend' }, { id: 'student-2', name: 'Max', course: 'B1 morgens' }], assignments: [], submissions: [submission, other] }} />)
  fireEvent.change(screen.getByLabelText('Kurs'), { target: { value: 'B1 am Abend' } })
  expect(screen.queryByRole('button', { name: /Max/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Alex/ }))
  expect(screen.getByText(submission.text)).toBeVisible()
  fireEvent.change(screen.getByLabelText('Was ist konkret gelungen?'), { target: { value: 'Der gewünschte Tag ist klar.' } })
  fireEvent.change(screen.getByLabelText('Lernschwerpunkt 1'), { target: { value: 'Die Frage ergänzen' } })
  fireEvent.change(screen.getByLabelText('Lernschwerpunkt 2 (optional)'), { target: { value: 'Passend abschließen' } })
  fireEvent.change(screen.getByLabelText('Kommentar und passende Verbesserung'), { target: { value: 'Ergänze eine konkrete Rückfrage zum Material.' } })
  fireEvent.change(screen.getByLabelText('Kleine Überarbeitungsaufgabe'), { target: { value: 'Schreibe eine neue Version mit einer Frage und einem Gruß.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Rückmeldung speichern' }))
  await waitFor(() => expect(reviewExamSubmission).toHaveBeenCalledWith(expect.objectContaining({ submissionId: submission.id, strengths: 'Der gewünschte Tag ist klar.', priorities: ['Die Frage ergänzen', 'Passend abschließen'], revision: 'Schreibe eine neue Version mit einer Frage und einem Gruß.' })))
  expect(await screen.findByRole('alert')).toHaveTextContent('Bitte erneut speichern.')
  expect(screen.getByLabelText('Kommentar und passende Verbesserung')).toHaveValue('Ergänze eine konkrete Rückfrage zum Material.')
  expect(screen.getByText(submission.text)).toBeVisible()
})

test('recording plan shows missing human media honestly and exposes full script and matching tasks', () => {
  render(<ExamAudioProductionPanel orders={EXAM_AUDIO_ORDERS} sessions={EXAM_RECORDING_SESSIONS} state={{ success: true, productions: [] }} />)
  expect(screen.getAllByRole('button', { name: /Rohaufnahme hochladen/ })).toHaveLength(8)
  fireEvent.click(screen.getByRole('button', { name: new RegExp(EXAM_AUDIO_ORDERS[0].title) }))
  expect(screen.getByText(EXAM_AUDIO_ORDERS[0].script)).toBeVisible()
  expect(screen.getByText('Aufnahme fehlt', { selector: 'span' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '2. Dateien' }))
  expect(screen.getByLabelText(/^Schnittdatei auswählen oder ersetzen/)).toBeDisabled()
  expect(screen.queryByText('Geprüfte Audiofassung veröffentlichen')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '1. Auftrag' }))
  fireEvent.click(screen.getByText(/Aufgaben, Lösungen und Belegstellen/))
  expect(screen.getByText(EXAM_AUDIO_ORDERS[0].tasks[0].instruction)).toBeVisible()
})

test('a submission made with help shows that evidence and keeps independent scoring unavailable', () => {
  render(<ExamTeacherPanel modules={EXAM_MODULES} state={{ success: true, actorRole: 'teacher', students: [{ id: 'student-1', name: 'Alex', course: null }], assignments: [], submissions: [{ ...submission, helped: true }] }} />)
  fireEvent.click(screen.getByRole('button', { name: /Alex/ }))
  expect(screen.getByText(/Bei diesem Beitrag wurden Lernhilfen genutzt/)).toBeVisible()
  expect(screen.getByLabelText(/^Lernstatus dieser Leistung/)).toHaveValue('assisted')
  expect(screen.getAllByRole('option', { name: 'Selbstständig gelungen' }).every(option => (option as HTMLOptionElement).disabled)).toBe(true)
})
