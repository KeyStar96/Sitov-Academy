'use server'

import { statfs } from 'node:fs/promises'
import { z } from 'zod'
import { withBackendSession, checkDatabaseError, checkRpcError } from '@/lib/actions/backend'

const usageSchema = z.object({
  total_bytes: z.number(),
  levels: z.array(z.object({ level: z.string(), bytes: z.number(), limit_bytes: z.number() })),
})
export async function getMediaStorageUsage() {
  return withBackendSession(async ({ supabase }) => {
    const { data, error } = await supabase.rpc('media_storage_usage')
    checkDatabaseError(error)
    checkRpcError(data)
    const usage = usageSchema.parse(data)
    const disk = await statfs('/')
    const totalBytes = disk.blocks * disk.bsize
    const usedBytes = (disk.blocks - disk.bfree) * disk.bsize
    return { ...usage, disk: { totalBytes, usedBytes, warning: usedBytes / totalBytes >= 0.8 } }
  }, 'staff')
}
