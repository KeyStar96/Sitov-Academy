import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '@/supabase/database.types'
import { learningResetBatchSchema, type ResetUserProgressResult } from '@/lib/types/reset-progress'
import { getRpcError } from '@/lib/rpc-errors'

async function retryDeadlock<T extends { data: unknown; error: { code?: string } | null }>(operation: () => PromiseLike<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const result = await operation()
    const failure = getRpcError(result.data)
    const deadlock = result.error?.code === '40P01' || failure?.sqlstate === '40P01' || failure?.error === '40P01' || failure?.error === 'retry_required'
    if (!deadlock || attempt >= 2) return result
  }
}

/** Storage and Postgres cannot share a transaction. Keep the server-side manifest
 * until every Storage API deletion is confirmed, then atomically clear learning data. */
export async function performLearningReset(client: SupabaseClient<Database>): Promise<ResetUserProgressResult> {
  try {
    const started = await retryDeadlock(() => client.rpc('begin_learning_reset', { p_confirmation: 'RESET_LEARNING_DATA' }))
    if (started.error) throw started.error
    if (getRpcError(started.data)) throw new Error('reset_start_failed')
    const token = z.uuid().parse(started.data)
    let lastBatch = ''
    const startedAt = Date.now()
    // Bounded requests can be resumed using the same persisted reset job.
    for (let iteration = 0; iteration < 100; iteration += 1) {
      if (Date.now() - startedAt > 20_000) return { success: false, reason: 'reset_in_progress' }
      const response = await retryDeadlock(() => client.rpc('learning_reset_audio_batch', { p_token: token }))
      if (response.error) throw response.error
      if (getRpcError(response.data)) throw new Error('reset_batch_failed')
      const batch = learningResetBatchSchema.parse(response.data)
      if (!batch.length) {
        const finished = await retryDeadlock(() => client.rpc('finish_learning_reset', { p_token: token }))
        if (finished.error || finished.data !== true) throw finished.error ?? new Error('reset_not_finalized')
        return { success: true }
      }
      const fingerprint = JSON.stringify(batch)
      if (fingerprint === lastBatch) throw new Error('audio_deletion_not_confirmed')
      lastBatch = fingerprint
      const { error } = await client.storage.from('pronunciation_audio').remove(batch.map(object => object.object_name))
      if (error) throw error
    }
    return { success: false, reason: 'reset_in_progress' }
  } catch (error) {
    console.error('[learning-reset] Pending reset retained for retry', { error: error instanceof Error ? error.message : 'backend_error' })
    return { success: false, reason: 'reset_failed' }
  }
}
