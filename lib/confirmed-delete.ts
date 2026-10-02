import 'server-only'

import { z } from 'zod'
import { getRpcError } from '@/lib/rpc-errors'
import { PRIVATE_PRONUNCIATION_BUCKET } from '@/lib/pronunciation-conversations'
import type { ConfirmedDeleteFailure } from '@/lib/types/profile-deletion'
import { createAdminClient } from '@/utils/supabase/admin'

const outcomeSchema = z.union([
  z.object({ success: z.literal(true), deleted: z.literal(true), status: z.string().optional() }),
  z.object({ success: z.literal(true), deleted: z.literal(false), pendingAudio: z.array(z.string().min(1).max(1024)).min(1).max(200) }),
])
const failures: ConfirmedDeleteFailure[] = ['invalid_input', 'not_authenticated', 'not_authorized', 'not_found', 'conflict']

export type ConfirmedDeleteResult = { success: true; status?: string } | { success: false; reason: ConfirmedDeleteFailure }

/**
 * Storage and Postgres cannot share a transaction. The delete RPCs of migration
 * 57 therefore first name the recordings that still exist (`pendingAudio`) and
 * only delete once none is left. A request that stops halfway can be repeated.
 *
 * `call` runs with the signed-in person's own client: the database decides who
 * may delete what. Only file names it returned are removed here, with the
 * service client, because Storage policies allow learners no direct deletes.
 */
export async function runConfirmedDelete(
  call: () => PromiseLike<{ data: unknown; error: { code?: string } | null }>,
): Promise<ConfirmedDeleteResult> {
  let lastBatch = ''
  // 25 rounds of at most 200 files; a larger archive continues with the next request.
  for (let round = 0; round < 25; round += 1) {
    const { data, error } = await call()
    if (error) return { success: false, reason: 'delete_failed' }
    const failure = getRpcError(data)
    if (failure) {
      const reason = failures.find(code => code === failure.error)
      return { success: false, reason: reason ?? 'delete_failed' }
    }
    const outcome = outcomeSchema.safeParse(data)
    if (!outcome.success) return { success: false, reason: 'delete_failed' }
    const result = outcome.data
    if (result.deleted === true) return { success: true, ...(result.status ? { status: result.status } : {}) }
    const fingerprint = JSON.stringify(result.pendingAudio)
    // The same files again: Storage accepted the request without removing them.
    if (fingerprint === lastBatch) return { success: false, reason: 'delete_failed' }
    lastBatch = fingerprint
    const { error: removeError } = await createAdminClient().storage.from(PRIVATE_PRONUNCIATION_BUCKET).remove(result.pendingAudio)
    if (removeError) return { success: false, reason: 'delete_failed' }
  }
  return { success: false, reason: 'delete_failed' }
}
