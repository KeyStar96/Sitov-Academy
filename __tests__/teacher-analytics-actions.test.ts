/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
import { createClient } from '@/utils/supabase/server'
import { getTeacherAnalyticsOptions } from '@/app/actions/teacher-analytics'
const studentId = '00000000-0000-4000-8000-000000000001'

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
    }, rpc: jest.fn(),
  } as never)
  expect(await getTeacherAnalyticsOptions()).toEqual({ success: true, data: { students: [{ id: studentId, name: 'Anna' }], levels: [{ code: 'A1.1' }, { code: 'A1.2' }] } })
  expect(queried).toEqual(['profiles', 'profiles', 'learning_levels'])
})

it('keeps the options staff-only', async () => {
  jest.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: studentId } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'student' } }) }) }) }),
  } as never)
  expect(await getTeacherAnalyticsOptions()).toEqual({ success: false, error: 'not_authorized' })
})
