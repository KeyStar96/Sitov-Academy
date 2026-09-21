'use server'

import { createClient } from '@/utils/supabase/server'
import { videoQuery, mapVideo } from '@/lib/learning-catalog'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { videoInputSchema, videoRecordSchema, type VideoWriteInput, type VideoWriteResult, type VideoDeleteResult, type VideoRecord } from '@/lib/video-links'
import { saveLearningContent, deleteLearningContent } from '@/lib/learning-writes'
import { vocabWriteSchema, type VocabWriteInput, type VocabSaveResult } from '@/lib/types/vocabulary-admin'
import { readAdminVocabulary, writeAdminVocabulary, removeAdminVocabulary } from '@/lib/admin-vocabulary'

/**
 * R10: Die Writer in lib/learning-writes.ts und lib/admin-vocabulary.ts werfen
 * `<Kontext>: <code>` mit dem RPC- bzw. SQLSTATE-Code. Ohne diese Extraktion
 * kollabierte jede Ursache — fehlende Rechte, Konflikt, ungültige Eingabe —
 * auf ein nicht unterscheidbares `save_failed`.
 */
function rpcCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const code = message.includes(':') ? message.slice(message.lastIndexOf(':') + 1).trim() : message.trim()
  return code || 'unknown'
}

// Helper to check if current user is admin/teacher
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated: not_authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Ein fehlgeschlagener Rollen-Read ist kein "nicht autorisiert": beides sperrt
  // zwar (fail-closed), aber nur mit eigenem Code ist der Ausfall diagnostizierbar.
  if (error) throw new Error(`Role lookup failed: ${error.code ?? 'unknown'}`)
  if (profile?.role !== 'admin' && profile?.role !== 'teacher') {
    throw new Error('Not authorized: not_authorized')
  }
  return supabase
}

// -------------------------------------------------------------
// VOCABULARY
// -------------------------------------------------------------
export async function getVocabs() {
  return readAdminVocabulary(await requireAdmin())
}

export async function addVocab(payload: VocabWriteInput): Promise<VocabSaveResult> {
  return saveVocabulary(payload)
}

export async function updateVocab(id: string, payload: VocabWriteInput): Promise<VocabSaveResult> {
  if (!z.uuid().safeParse(id).success) return { success: false, error: 'invalid_input' }
  return saveVocabulary(payload, id)
}

async function saveVocabulary(payload: VocabWriteInput, id?: string): Promise<VocabSaveResult> {
  const parsed = vocabWriteSchema.safeParse(payload)
  if (!parsed.success) return { success: false, error: 'invalid_input' }
  try {
    const supabase = await requireAdmin()
    const data = await writeAdminVocabulary(supabase, parsed.data, id)
    revalidatePath('/[lang]/admin/content/vocabulary', 'page')
    revalidatePath('/[lang]/dashboard/vocabulary', 'layout')
    return { success: true, data }
  } catch (error) {
    console.error("[cms] vocab_save_failed")
    return { success: false, error: 'save_failed', code: rpcCode(error) }
  }
}

export async function deleteVocab(id: string) {
  if (!z.uuid().safeParse(id).success) return { success: false, error: 'invalid_input' }
  try {
    await removeAdminVocabulary(await requireAdmin(), id)
    revalidatePath('/[lang]/admin/content/vocabulary', 'page')
    return { success: true }
  } catch (error) {
    console.error("[cms] vocab_delete_failed")
    return { success: false, error: 'delete_failed', code: rpcCode(error) }
  }
}

// -------------------------------------------------------------
// VIDEOS
// -------------------------------------------------------------
export async function getVideos(): Promise<VideoRecord[]> {
  try {
    const supabase = await requireAdmin()
    const { data, error } = await videoQuery(supabase).order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(row => mapVideo(row))
  } catch (error) {
    console.error("[cms] video_load_failed")
    throw new Error(`video_load_failed: ${rpcCode(error)}`)
  }
}

export async function addVideo(payload: VideoWriteInput): Promise<VideoWriteResult> { return saveVideo(payload) }
export async function updateVideo(id: string, payload: VideoWriteInput): Promise<VideoWriteResult> {
  if (!z.uuid().safeParse(id).success) return { success: false, error: 'invalid_input' }
  return saveVideo(payload, id)
}
async function saveVideo(payload: VideoWriteInput, id?: string): Promise<VideoWriteResult> {
  const parsed = videoInputSchema.safeParse(payload)
  if (!parsed.success) return { success: false, error: 'invalid_input' }
  try {
    const supabase = await requireAdmin()
    const data = videoRecordSchema.parse(await saveLearningContent(supabase, 'videos', parsed.data, id))
    revalidatePath('/[lang]/admin/content/videos', 'page')
    revalidatePath('/[lang]/dashboard/level/[level]/videos', 'page')
    return { success: true, data }
  } catch (error) {
    console.error("[cms] video_save_failed")
    return { success: false, error: 'save_failed', code: rpcCode(error) }
  }
}
export async function deleteVideo(id: string): Promise<VideoDeleteResult> {
  if (!z.uuid().safeParse(id).success) return { success: false, error: 'invalid_input' }
  try {
    const supabase = await requireAdmin()
    await deleteLearningContent(supabase, 'videos', id)
    revalidatePath('/[lang]/admin/content/videos', 'page')
    revalidatePath('/[lang]/dashboard/level/[level]/videos', 'page')
    return { success: true }
  } catch (error) {
    console.error("[cms] video_delete_failed")
    return { success: false, error: 'delete_failed', code: rpcCode(error) }
  }
}
