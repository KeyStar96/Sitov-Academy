/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
import { createClient } from '@/utils/supabase/server'
import { getMyLearningProgress, getStudentLearningProgress } from '@/app/actions/learning-progress'
import { recordMediaView } from '@/app/actions/media-views'
import { progressPayload, progressStudentId as studentId } from './fixtures/learning-progress'

const rpc = jest.fn()
function session(role: string, signedIn = true) {
  jest.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: studentId } : null } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role } }) }) }) }), rpc,
  } as never)
}
beforeEach(() => { jest.clearAllMocks(); session('teacher'); jest.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => jest.restoreAllMocks())

it('reads another learner only as staff and never with forged or malformed filters', async () => {
  session('student'); expect(await getStudentLearningProgress({ studentId, level: null, days: 30 })).toEqual({ success: false, error: 'not_authorized' })
  session('teacher', false); expect(await getStudentLearningProgress({ studentId, level: null, days: 30 })).toEqual({ success: false, error: 'not_authenticated' })
  session('teacher')
  for (const input of [{ studentId, level: null, days: 14 }, { studentId: 'x', level: null, days: 30 }, { studentId, level: '  ', days: 30 }, { studentId, level: null, days: 30, courseId: studentId }])
    expect(await getStudentLearningProgress(input)).toEqual({ success: false, error: 'invalid_input' })
  expect(rpc).not.toHaveBeenCalled()
})

it('calls the per-mode aggregate and validates its contract', async () => {
  rpc.mockResolvedValue({ data: progressPayload(7), error: null })
  const result = await getStudentLearningProgress({ studentId, level: 'A1.1', days: 7 })
  expect(rpc).toHaveBeenCalledWith('get_learning_progress', { p_student_id: studentId, p_level: 'A1.1', p_days: 7 })
  expect(result.success && result.data.daily).toHaveLength(7)
  expect(result.success && 'success' in result.data).toBe(false)
  rpc.mockResolvedValue({ data: { error: 'not_found', message: 'Student not found.' }, error: null })
  expect(await getStudentLearningProgress({ studentId, level: null, days: 7 })).toEqual({ success: false, error: 'not_found' })
})

it('rejects inconsistent aggregates instead of showing invented numbers', async () => {
  const broken = progressPayload(7, '2026-09-30', (day, index) => index === 6 ? { ...day, vocabulary: { ...day.vocabulary, answers: 1, correct: 2 } } : day)
  rpc.mockResolvedValue({ data: broken, error: null })
  expect(await getStudentLearningProgress({ studentId, level: null, days: 7 })).toEqual({ success: false, error: 'invalid_input' })
  rpc.mockResolvedValue({ data: { ...progressPayload(7), today: '2026-10-01' }, error: null })
  expect(await getStudentLearningProgress({ studentId, level: null, days: 7 })).toEqual({ success: false, error: 'invalid_input' })
})

it('lets learners read only themselves', async () => {
  session('student')
  rpc.mockResolvedValue({ data: progressPayload(30), error: null })
  expect((await getMyLearningProgress({ level: null, days: 30 })).success).toBe(true)
  expect(rpc).toHaveBeenCalledWith('get_learning_progress', { p_student_id: null, p_level: null, p_days: 30 })
  expect(await getMyLearningProgress({ level: null, days: 30, studentId })).toEqual({ success: false, error: 'invalid_input' })
})

it('records media views silently and only for known media kinds', async () => {
  session('student')
  rpc.mockResolvedValue({ data: { success: true, recorded: true }, error: null })
  expect(await recordMediaView('video', studentId)).toEqual({ recorded: true })
  expect(rpc).toHaveBeenCalledWith('record_media_view', { p_kind: 'video', p_object_id: studentId })
  expect(await recordMediaView('audio', studentId)).toEqual({ recorded: false })
  expect(await recordMediaView('presentation', 'x')).toEqual({ recorded: false })
  rpc.mockResolvedValue({ data: { error: 'not_found', message: 'Media not found.' }, error: null })
  expect(await recordMediaView('presentation', studentId)).toEqual({ recorded: false })
  rpc.mockRejectedValue(new Error('offline'))
  expect(await recordMediaView('video', studentId)).toEqual({ recorded: false })
})
