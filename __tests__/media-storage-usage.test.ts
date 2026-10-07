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
  jest.mocked(statfs).mockResolvedValue({ blocks: 100, bfree: free, bavail: Math.max(0, free - 5), bsize: 4096 } as Awaited<ReturnType<typeof statfs>>)
  const result = await getMediaStorageUsage()
  expect(result).toEqual({ success: true, data: { total_bytes: 1024, levels: [{ level: 'A1.1', bytes: 1024, limit_bytes: 21474836480 }], disk: { totalBytes: 409600, usedBytes: (100 - free) * 4096, availableBytes: Math.max(0, free - 5) * 4096, warning } } })
})
it('retains measured media totals and quotas independently of the whole server disk', async () => {
  const usage = {
    total_bytes: 1024, storage_total_bytes: 5120, unknown_size_objects: 1,
    levels: [{ level: 'A1.1', bytes: 1024, limit_bytes: 21474836480 }],
    buckets: [{ bucket_id: 'audio_cache', bytes: 4096, object_count: 2, unknown_size_objects: 1, limit_bytes: 8589934592 }],
  }
  setup().mockResolvedValue({ data: usage, error: null })
  jest.mocked(statfs).mockResolvedValue({ blocks: 100, bfree: 30, bavail: 20, bsize: 4096 } as Awaited<ReturnType<typeof statfs>>)
  expect(await getMediaStorageUsage()).toEqual({ success: true, data: { ...usage, disk: { totalBytes: 409600, usedBytes: 286720, availableBytes: 81920, warning: false } } })
})
it('keeps media statistics available when host disk statistics cannot be read', async () => {
  setup()
  jest.mocked(statfs).mockRejectedValue(new Error('disk_unavailable'))
  expect(await getMediaStorageUsage()).toEqual({ success: true, data: { total_bytes: 1024, levels: [{ level: 'A1.1', bytes: 1024, limit_bytes: 21474836480 }], disk: null } })
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
