'use server'

import { createClient } from '@/utils/supabase/server'
import { sitovCheckpointTarget, sitovCheckpointSchema, sitovVideoProgressSchema, type LearningCheckpointKind, type LearningCheckpointResult } from '@/lib/learning-checkpoints'
import type { Json } from '@/supabase/database.types'

async function checkpointRequest(action: 'get' | 'save' | 'clear', kind: LearningCheckpointKind, level: string, state?: Record<string, unknown>, expectedRevision?: number, expectedLearnerId?: string): Promise<LearningCheckpointResult> {
  if (!sitovCheckpointTarget.safeParse({ kind, level }).success || (action !== 'get' && (!Number.isSafeInteger(expectedRevision) || expectedRevision! < 0))) return { ok: false, error: 'invalid' }
  try {
    if (action === 'save' && (!state || Array.isArray(state) || typeof state !== 'object' || JSON.stringify(state).length > 262144)) return { ok: false, error: 'invalid' }
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || (expectedLearnerId !== undefined && expectedLearnerId !== user.id)) return { ok: false, error: 'unauthorized' }
    // Checkpoint contents are UI state, never a source of grading or access.
    // Referenced media and prompts must still belong to the accessible catalog.
    if (action === 'save' && kind === 'videos' && state?.progress !== undefined) {
      const progress = sitovVideoProgressSchema.safeParse(state.progress)
      if (!progress.success) return { ok: false, error: 'invalid' }
      const ids = Object.keys(progress.data)
      if (ids.length > 1000) return { ok: false, error: 'invalid' }
      if (ids.length) {
        const { data, error } = await supabase.from('learning_videos').select('id,storage_path,unit:learning_units!inner(level)').in('id', ids).eq('unit.level', level)
        if (error) return { ok: false, error: 'unavailable' }
        if (!data || data.filter(row => row.storage_path !== null).length !== ids.length) return { ok: false, error: 'unauthorized' }
      }
    }
    if (action === 'save' && kind === 'pronunciation' && state?.promptId !== undefined) {
      if (typeof state.promptId !== 'string') return { ok: false, error: 'invalid' }
      const { data, error } = await supabase.from('learning_reading_texts').select('id,unit:learning_units!inner(level)').eq('id', state.promptId).eq('unit.level', level).maybeSingle()
      if (error) return { ok: false, error: 'unavailable' }
      if (!data) return { ok: false, error: 'unauthorized' }
    }
    const { data, error } = await supabase.rpc('sitov_learning_checkpoint', { p_action: action, p_kind: kind, p_level: level, p_state: (state ?? null) as Json, p_expected_revision: expectedRevision ?? null })
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'unavailable' }
    const result = data as { error?: string; checkpoint?: unknown }
    if (!result.error && !Object.hasOwn(result, 'checkpoint')) return { ok: false, error: 'unavailable' }
    const parsed = result.checkpoint == null ? null : sitovCheckpointSchema.safeParse(result.checkpoint)
    if (parsed && !parsed.success) return { ok: false, error: 'unavailable' }
    const checkpoint = parsed?.success ? parsed.data : null
    if (result.error) return { ok: false, error: result.error === 'conflict' ? 'conflict' : result.error === 'not_authorized' || result.error === 'not_authenticated' ? 'unauthorized' : result.error === 'invalid_input' ? 'invalid' : 'unavailable', checkpoint }
    return { ok: true, checkpoint, learnerId: user.id }
  } catch { return { ok: false, error: 'unavailable' } }
}

export async function loadLearningCheckpoint(kind: LearningCheckpointKind, level: string, expectedLearnerId?: string) { return checkpointRequest('get', kind, level, undefined, undefined, expectedLearnerId) }
export async function saveLearningCheckpoint(kind: LearningCheckpointKind, level: string, state: Record<string, unknown>, expectedRevision: number, expectedLearnerId?: string) { return checkpointRequest('save', kind, level, state, expectedRevision, expectedLearnerId) }
export async function clearLearningCheckpoint(kind: LearningCheckpointKind, level: string, expectedRevision: number, expectedLearnerId?: string) { return checkpointRequest('clear', kind, level, undefined, expectedRevision, expectedLearnerId) }
