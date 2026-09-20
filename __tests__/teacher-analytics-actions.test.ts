/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
import { createClient } from '@/utils/supabase/server'
import { getTeacherAnalytics } from '@/app/actions/teacher-analytics'
const studentId = '00000000-0000-4000-8000-000000000001'
const rpc = jest.fn()
function session(role: string, signedIn = true) {
  jest.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: studentId } : null } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role } }) }) }) }), rpc,
  } as never)
}
beforeEach(() => { jest.clearAllMocks(); session('teacher') })
it('requires staff authorization before calling the aggregate', async () => {
  session('student'); expect(await getTeacherAnalytics({ studentId, courseId: null })).toEqual({ success: false, error: 'not_authorized' })
  session('teacher', false); expect(await getTeacherAnalytics({ studentId, courseId: null })).toEqual({ success: false, error: 'not_authenticated' })
  expect(rpc).not.toHaveBeenCalled()
})
it('rejects forged or malformed inputs without sending an RPC', async () => {
  expect(await getTeacherAnalytics({ studentId, courseId: null, role: 'admin' })).toEqual({ success: false, error: 'invalid_input' })
  expect(await getTeacherAnalytics({ studentId: 'not-a-uuid', courseId: null })).toEqual({ success: false, error: 'invalid_input' })
  expect(rpc).not.toHaveBeenCalled()
})
it('calls the detailed Phase 4 aggregate overload and preserves explicit RPC errors', async () => {
  rpc.mockResolvedValue({ data: { error: 'not_found', message: 'Student not found.' }, error: null })
  expect(await getTeacherAnalytics({ studentId, courseId: null })).toEqual({ success: false, error: 'not_found' })
  expect(rpc).toHaveBeenCalledWith('get_all_students_progress_data', { p_student_id: studentId, p_course_id: null })
})
it('rejects malformed or truncated backend data', async () => {
  rpc.mockResolvedValue({ data: { studentId, history: [] }, error: null })
  expect(await getTeacherAnalytics({ studentId, courseId: null })).toEqual({ success: false, error: 'invalid_input' })
})
