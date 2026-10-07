'use server'

import { statfs } from 'node:fs/promises'
import { z } from 'zod'
import { withBackendSession, checkDatabaseError, checkRpcError } from '@/lib/actions/backend'

const usageSchema = z.object({
  total_bytes: z.number().nonnegative(),
  levels: z.array(z.object({ level: z.string(), bytes: z.number().nonnegative(), limit_bytes: z.number().positive() })),
  // Optional until migration 89 has been applied; never present course-assets
  // as the total of all Storage buckets when talking to an older database.
  storage_total_bytes: z.number().nonnegative().optional(),
  unknown_size_objects: z.number().int().nonnegative().optional(),
  buckets: z.array(z.object({
    bucket_id: z.string(), bytes: z.number().nonnegative(), object_count: z.number().int().nonnegative(),
    unknown_size_objects: z.number().int().nonnegative(), limit_bytes: z.number().positive().nullable(),
  })).optional(),
})
export async function getMediaStorageUsage() {
  return withBackendSession(async ({ supabase }) => {
    const { data, error } = await supabase.rpc('media_storage_usage')
    checkDatabaseError(error)
    checkRpcError(data)
    const usage = usageSchema.parse(data)
    const filesystem = await statfs('/').catch(() => null)
    if (!filesystem || filesystem.blocks <= 0) return { ...usage, disk: null }
    const totalBytes = filesystem.blocks * filesystem.bsize
    const usedBytes = (filesystem.blocks - filesystem.bfree) * filesystem.bsize
    // bavail excludes filesystem blocks reserved for root; these cannot be
    // used by the normal application process for uploads or audio imports.
    const availableBytes = filesystem.bavail * filesystem.bsize
    return { ...usage, disk: { totalBytes, usedBytes, availableBytes, warning: usedBytes / totalBytes >= 0.8 } }
  }, 'staff')
}
