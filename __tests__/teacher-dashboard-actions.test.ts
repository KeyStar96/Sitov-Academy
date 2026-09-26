import { getTeacherStudents, getTeacherStudentDetail, interveneTeacherPath } from '@/app/actions/teacher-dashboard'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { teacherDashboardError, teacherAttentionLabel } from '@/lib/teacher-dashboard-i18n'

jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
const id = '00000000-0000-4000-8000-000000000001'
const unitId = '00000000-0000-4000-8000-000000000002'
const requestId = '00000000-0000-4000-8000-000000000003'
function setup(data: unknown, error: unknown = null, user: unknown = { id: 'teacher' }) {
  const rpc = jest.fn().mockResolvedValue({ data, error })
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) }, rpc } as unknown as Awaited<ReturnType<typeof createClient>>)
  return rpc
}
beforeEach(() => jest.clearAllMocks())
it.each(['unlock', 'reset_path'] as const)('sends explicit null node to the idempotent %s overload', async action => {
  const rpc = setup({ success: true, interventionId: id })
  expect(await interveneTeacherPath({ studentId: id, unitId, action, nodeId: null, requestId })).toEqual({ data: { success: true } })
  expect(rpc).toHaveBeenCalledWith('manage_learning_path', { p_student_id: id, p_unit_id: unitId, p_action: action, p_node_id: null, p_request_id: requestId })
  expect(revalidatePath).toHaveBeenCalledWith('/[lang]/admin/students/[id]', 'page')
  expect(revalidatePath).toHaveBeenCalledWith('/[lang]/dashboard/level/[level]/exercises', 'page')
})
it('requires a test node and rejects extraneous targets before calling the database', async () => {
  const rpc = setup({ success: true })
  expect(await interveneTeacherPath({ studentId: id, unitId, action: 'reset_test', nodeId: null, requestId })).toEqual({ error: 'invalid_input' })
  expect(await interveneTeacherPath({ studentId: id, unitId, action: 'unlock', nodeId: id, requestId })).toEqual({ error: 'invalid_input' })
  expect(rpc).not.toHaveBeenCalled()
})
it.each(['not_authorized', 'learning_reset_in_progress', 'path_locked', 'request_conflict'])('preserves the structured %s failure and does not revalidate', async error => {
  setup({ error })
  expect(await interveneTeacherPath({ studentId: id, unitId, action: 'unlock', nodeId: null, requestId })).toEqual({ error })
  expect(revalidatePath).not.toHaveBeenCalled()
})
it('refuses requests without a cookie-authenticated identity', async () => {
  const rpc = setup({ success: true }, null, null)
  expect(await getTeacherStudents()).toEqual({ error: 'authentication_required' })
  expect(await getTeacherStudentDetail(id, 'notes', 'de')).toEqual({ error: 'authentication_required' })
  expect(await interveneTeacherPath({ studentId: id, unitId, action: 'unlock', nodeId: null, requestId })).toEqual({ error: 'authentication_required' })
  expect(rpc).not.toHaveBeenCalled()
})
it('rejects incomplete list data instead of substituting zero metrics', async () => {
  setup({ success: true, students: [{ id }] })
  expect(await getTeacherStudents()).toEqual({ error: 'invalid_response' })
})
it('whitelists vocabulary fields and strips accidental private content', async () => {
  setup({ success: true, data: { byLevel: [], byLesson: [], halfKnown: [], hardest: [], recentAnswers: [], pausedLessons: [], carryover: [], ownWordCount: 3, ownWords: ['private'] } })
  const result = await getTeacherStudentDetail(id, 'vocabulary', 'tr')
  expect(result.data).toMatchObject({ ownWordCount: 3 })
  expect(result.data).not.toHaveProperty('ownWords')
})
it('reports missing backend RPCs explicitly and validates tab/locale before I/O', async () => {
  const rpc = setup(null, { code: 'PGRST202' })
  expect(await getTeacherStudents()).toEqual({ error: 'backend_unavailable' })
  rpc.mockClear()
  expect(await getTeacherStudentDetail(id, 'notes', 'xx')).toEqual({ error: 'invalid_input' })
  expect(rpc).not.toHaveBeenCalled()
})
it.each(['de', 'en', 'ru', 'uk', 'tr'])('translates every real dashboard failure and attention reason in %s', lang => {
  const errors = ['not_authorized', 'authentication_required', 'invalid_input', 'not_found', 'learning_reset_in_progress', 'path_locked', 'request_conflict', 'request_failed']
  for (const code of errors) expect(teacherDashboardError(lang, code)).not.toBe(code)
  expect(teacherDashboardError(lang, 'path_locked')).not.toBe(teacherDashboardError(lang, 'request_failed'))
  for (const reason of ['inactive_7_days', 'failed_test_twice', 'over_150_due_cards', 'accuracy_below_50']) expect(teacherAttentionLabel(lang, reason)).not.toBe(reason)
})
