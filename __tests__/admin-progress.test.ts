/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
import { createClient } from '@/utils/supabase/server'
import { getAllStudentsProgressData } from '@/app/actions/admin'
const id = '00000000-0000-4000-8000-000000000001', rpc = jest.fn()
beforeEach(() => {
  jest.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'teacher' } }) }) }) }), rpc,
  } as never)
})
it('returns validated SQL percentages', async () => {
  rpc.mockResolvedValue({ data: { [id]: { 'A1.1': 50, 'A1.2': 0 } }, error: null })
  expect(await getAllStudentsProgressData()).toEqual({ [id]: { 'A1.1': 50, 'A1.2': 0 } })
})
it.each([
  { data: { error: 'not_authorized', message: 'Staff access required.' }, error: null },
  { data: null, error: { code: '0A000', message: 'private data' } },
  { data: null, error: null },
  { data: { [id]: { 'A1.1': 101 } }, error: null },
  { data: { [id]: { 'invalid-level': 50 } }, error: null },
])('propagates failures to the admin error boundary instead of returning empty progress', async result => {
  rpc.mockResolvedValue(result)
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try { await expect(getAllStudentsProgressData()).rejects.toThrow('student_progress_unavailable') }
  finally { log.mockRestore() }
})
