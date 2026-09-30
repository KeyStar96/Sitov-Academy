jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn(), revalidateTag: jest.fn() }))
import { createClient } from '@/utils/supabase/server'
import { revalidateTag } from 'next/cache'
import { cancelCourseDate, cancelWholeDay, restoreCancellation } from '@/app/actions/course-cancellations'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const rpc = jest.fn()
let courses: Array<{ id: string; archived_at: string | null }> = []

function session(role: string) {
  const profile = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { role }, error: null }) }
  const courseQuery = {
    select: jest.fn().mockReturnThis(),
    in: jest.fn((_key: string, ids: string[]) => Promise.resolve({ data: courses.filter(row => ids.includes(row.id)), error: null })),
  }
  jest.mocked(createClient).mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'staff' } }, error: null }) },
    from: jest.fn((table: string) => (table === 'profiles' ? profile : courseQuery)),
    rpc,
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

beforeEach(() => {
  jest.clearAllMocks()
  courses = [{ id: id(1), archived_at: null }, { id: id(2), archived_at: null }, { id: id(3), archived_at: '2026-01-01T00:00:00Z' }]
  rpc.mockImplementation(async (name: string) => (name === 'delete_course_exception' ? { data: { deleted: true }, error: null } : { data: { id: id(50) }, error: null }))
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

test('students cannot create or undo cancellations', async () => {
  session('student')
  expect(await cancelCourseDate({ courseId: id(1), date: '2026-10-05', reason: 'Feiertag' })).toEqual({ success: false, error: 'not_authorized' })
  expect(await cancelWholeDay({ courseIds: [id(1)], date: '2026-10-05', reason: 'Feiertag' })).toEqual({ success: false, error: 'not_authorized' })
  expect(await restoreCancellation({ id: id(50) })).toEqual({ success: false, error: 'not_authorized' })
  expect(rpc).not.toHaveBeenCalled()
})

test('a single cancellation uses the existing staff RPC and refreshes the public calendar', async () => {
  session('teacher')
  expect(await cancelCourseDate({ courseId: id(1), date: '2026-10-05', reason: '  Feiertag ' })).toEqual({ success: true, data: { id: id(50) } })
  expect(rpc).toHaveBeenCalledWith('save_course_exception', { p_course_id: id(1), p_date: '2026-10-05', p_reason: 'Feiertag' })
  expect(revalidateTag).toHaveBeenCalledWith('courses', { expire: 0 })
})

test.each([
  [{ courseId: id(1), date: '2026-02-30', reason: 'x' }],
  [{ courseId: id(1), date: '2026-10-05', reason: '   ' }],
  [{ courseId: id(1), date: '2026-10-05', reason: '<b>x</b>' }],
  [{ courseId: 'nope', date: '2026-10-05', reason: 'x' }],
])('invalid input %j is rejected before any write', async input => {
  session('teacher')
  expect(await cancelCourseDate(input)).toEqual({ success: false, error: 'invalid_input' })
  expect(rpc).not.toHaveBeenCalled()
})

test('a whole day saves one entry per course and reports partial failures', async () => {
  session('admin')
  rpc.mockResolvedValueOnce({ data: { id: id(51) }, error: null }).mockResolvedValueOnce({ data: { error: 'save_failed', message: 'x' }, error: null })
  expect(await cancelWholeDay({ date: '2026-10-05', reason: 'Feiertag', courseIds: [id(1), id(2)] })).toEqual({
    success: true, data: { results: [{ courseId: id(1), saved: true }, { courseId: id(2), saved: false }] },
  })
  expect(rpc).toHaveBeenNthCalledWith(1, 'save_course_exception', { p_course_id: id(1), p_date: '2026-10-05', p_reason: 'Feiertag' })
  expect(rpc).toHaveBeenNthCalledWith(2, 'save_course_exception', { p_course_id: id(2), p_date: '2026-10-05', p_reason: 'Feiertag' })
})

test('archived, unknown or duplicate courses abort a whole day without writing', async () => {
  session('teacher')
  for (const courseIds of [[id(1), id(3)], [id(1), id(9)], [id(1), id(1)]]) {
    expect(await cancelWholeDay({ date: '2026-10-05', reason: 'Feiertag', courseIds })).toEqual({ success: false, error: 'invalid_input' })
  }
  expect(rpc).not.toHaveBeenCalled()
})

test('undo deletes only the chosen cancellation marker and maps missing rows', async () => {
  session('teacher')
  expect(await restoreCancellation({ id: id(50) })).toEqual({ success: true, data: { deleted: true } })
  expect(rpc).toHaveBeenCalledWith('delete_course_exception', { p_id: id(50) })
  rpc.mockResolvedValueOnce({ data: { error: 'not_found', message: 'gone' }, error: null })
  expect(await restoreCancellation({ id: id(50) })).toEqual({ success: false, error: 'not_found' })
})
