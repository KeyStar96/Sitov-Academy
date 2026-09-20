/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('node:fs/promises', () => ({ statfs: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
import { statfs } from 'node:fs/promises'
import { createClient } from '@/utils/supabase/server'
import { getMediaStorageUsage } from '@/app/actions/media-storage'

function setup(role = 'teacher') {
  const rpc = jest.fn().mockResolvedValue({ data: { total_bytes: 1024, levels: [{ level: 'A1.1', bytes: 1024, limit_bytes: 21474836480 }] }, error: null })
  const profile = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { role }, error: null }) }
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'staff' } }, error: null }) }, from: () => profile, rpc } as unknown as Awaited<ReturnType<typeof createClient>>)
  return rpc
}
beforeEach(() => jest.clearAllMocks())
it.each([[21, false], [20, true], [0, true]])('warns at 80%% actual disk usage (free blocks=%s)', async (free, warning) => {
  setup()
  jest.mocked(statfs).mockResolvedValue({ blocks: 100, bfree: free, bsize: 4096 } as Awaited<ReturnType<typeof statfs>>)
  const result = await getMediaStorageUsage()
  expect(result).toEqual({ success: true, data: { total_bytes: 1024, levels: [{ level: 'A1.1', bytes: 1024, limit_bytes: 21474836480 }], disk: { totalBytes: 409600, usedBytes: (100 - free) * 4096, warning } } })
})
it('denies students before querying storage or host disk information', async () => {
  const rpc = setup('student')
  expect(await getMediaStorageUsage()).toEqual({ success: false, error: 'not_authorized' })
  expect(rpc).not.toHaveBeenCalled()
  expect(statfs).not.toHaveBeenCalled()
})
it('does not turn an RPC JSON error into storage statistics', async () => {
  setup().mockResolvedValue({ data: { error: 'not_authorized', message: 'Staff required.' }, error: null })
  expect(await getMediaStorageUsage()).toEqual({ success: false, error: 'not_authorized' })
  expect(statfs).not.toHaveBeenCalled()
})
