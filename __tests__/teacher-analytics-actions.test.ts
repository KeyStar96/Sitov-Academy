/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
import { createClient } from '@/utils/supabase/server'
import { getTeacherAnalytics, getTeacherAnalyticsOptions } from '@/app/actions/teacher-analytics'
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
  session('student'); expect(await getTeacherAnalytics({ studentId, level: null })).toEqual({ success: false, error: 'not_authorized' })
  session('teacher', false); expect(await getTeacherAnalytics({ studentId, level: null })).toEqual({ success: false, error: 'not_authenticated' })
  expect(rpc).not.toHaveBeenCalled()
})
it('rejects forged or malformed inputs without sending an RPC', async () => {
  expect(await getTeacherAnalytics({ studentId, level: null, role: 'admin' })).toEqual({ success: false, error: 'invalid_input' })
  expect(await getTeacherAnalytics({ studentId: 'not-a-uuid', level: null })).toEqual({ success: false, error: 'invalid_input' })
  expect(rpc).not.toHaveBeenCalled()
})
it('calls the independent trainer-level aggregate and preserves explicit RPC errors', async () => {
  rpc.mockResolvedValue({ data: { error: 'not_found', message: 'Student not found.' }, error: null })
  expect(await getTeacherAnalytics({ studentId, level: null })).toEqual({ success: false, error: 'not_found' })
  expect(rpc).toHaveBeenCalledWith('get_student_learning_analytics', { p_student_id: studentId, p_level: null })
})
it('rejects malformed or truncated backend data', async () => {
  rpc.mockResolvedValue({ data: { studentId, history: [] }, error: null })
  expect(await getTeacherAnalytics({ studentId, level: null })).toEqual({ success: false, error: 'invalid_input' })
})

it('rejects course-based filters and empty levels instead of inferring course participation', async () => {
  expect(await getTeacherAnalytics({ studentId, courseId: studentId })).toEqual({ success: false, error: 'invalid_input' })
  expect(await getTeacherAnalytics({ studentId, level: '   ' })).toEqual({ success: false, error: 'invalid_input' })
  expect(rpc).not.toHaveBeenCalled()
})
it('loads filter choices only from trainer learning levels', async () => {
  const queried: string[] = []
  jest.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: studentId } } }) },
    from: (table: string) => {
      queried.push(table)
      const chain = {
        select: () => chain, eq: () => chain, order: () => chain,
        single: async () => ({ data: { role: 'teacher' } }),
        range: async () => ({ data: table === 'profiles' ? [{ id: studentId, person: { display_name: 'Anna' } }] : [{ code: 'A1.1' }, { code: 'A1.2' }], error: null }),
      }
      return chain
    }, rpc,
  } as never)
  expect(await getTeacherAnalyticsOptions()).toEqual({ success: true, data: { students: [{ id: studentId, name: 'Anna' }], levels: [{ code: 'A1.1' }, { code: 'A1.2' }] } })
  expect(queried).toEqual(['profiles', 'profiles', 'learning_levels'])
})
