jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn(), revalidateTag: jest.fn() }))
import { createClient } from '@/utils/supabase/server'
import { saveCourse } from '@/app/actions/course-cms'
import type { CourseEditor } from '@/lib/business-courses'

const courseId = '00000000-0000-4000-8000-000000000001'
const course: CourseEditor = { id: courseId, slug: 'future-c2', title: 'Gesprächsrunde', description: '', type: 'online', category: 'speaking', level: 'C2', unit_price: 15, unit_minutes: 60, start_date: '', end_date: '', trial_lessons: false, sort_order: 125, archived: false, schedules: [{ weekday: 6, start_time: '10:00', end_time: '11:00' }], translations: [], exceptions: [] }
const rpc = jest.fn()
const exceptionReads: string[] = []

function session(role: string, stored: Array<{ date: string; reason: string }>) {
  const profile = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { role }, error: null }) }
  const exceptions = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn((key: string, value: string) => { exceptionReads.push(`${key}=${value}`); return exceptions }),
    order: jest.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => void) => resolve({ data: stored, error: null }),
  }
  jest.mocked(createClient).mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'staff' } }, error: null }) },
    from: jest.fn((table: string) => (table === 'profiles' ? profile : exceptions)),
    rpc,
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

beforeEach(() => { jest.clearAllMocks(); exceptionReads.length = 0; rpc.mockResolvedValue({ data: courseId, error: null }); jest.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => jest.restoreAllMocks())

test('editing a course always re-sends the stored cancellations, never the client copy', async () => {
  session('teacher', [{ date: '2026-10-03', reason: 'Feiertag' }, { date: '2026-11-05', reason: 'Fortbildung' }])
  expect(await saveCourse({ ...course, exceptions: [] })).toEqual({ success: true, data: { id: courseId } })
  expect(exceptionReads).toEqual([`course_id=${courseId}`])
  expect(rpc).toHaveBeenCalledWith('save_business_course', { p_data: expect.objectContaining({ id: courseId, exceptions: [{ date: '2026-10-03', reason: 'Feiertag' }, { date: '2026-11-05', reason: 'Fortbildung' }] }) })
})

test('a stale client list cannot resurrect or add cancellations either', async () => {
  session('admin', [])
  await saveCourse({ ...course, exceptions: [{ date: '2026-12-24', reason: 'Alt' }] })
  expect(rpc).toHaveBeenCalledWith('save_business_course', { p_data: expect.objectContaining({ exceptions: [] }) })
})

test('a new course starts without cancellations and without reading any', async () => {
  session('teacher', [{ date: '2026-10-03', reason: 'fremd' }])
  const { id: _omit, ...draft } = course
  void _omit
  await saveCourse({ ...draft, exceptions: [{ date: '2026-10-03', reason: 'x' }] })
  expect(exceptionReads).toEqual([])
  expect(rpc).toHaveBeenCalledWith('save_business_course', { p_data: expect.objectContaining({ exceptions: [] }) })
})

test('students cannot save courses', async () => {
  session('student', [])
  expect(await saveCourse(course)).toEqual({ success: false, error: 'not_authorized' })
  expect(rpc).not.toHaveBeenCalled()
})
