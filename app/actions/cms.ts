'use server'

import { createClient } from '@/utils/supabase/server'
import { videoQuery, mapVideo } from '@/lib/learning-catalog'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { videoInputSchema, videoRecordSchema, type VideoWriteInput, type VideoWriteResult, type VideoDeleteResult, type VideoRecord } from '@/lib/video-links'
import { saveLearningContent, deleteLearningContent } from '@/lib/learning-writes'
import { vocabWriteSchema, type VocabWriteInput, type VocabSaveResult } from '@/lib/types/vocabulary-admin'
import { readAdminVocabulary, writeAdminVocabulary, removeAdminVocabulary } from '@/lib/admin-vocabulary'

// Helper to check if current user is admin/teacher
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
    
  if (profile?.role !== 'admin' && profile?.role !== 'teacher') {
    throw new Error('Not authorized')
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
  } catch {
    return { success: false, error: 'save_failed' }
  }
}

export async function deleteVocab(id: string) {
  if (!z.uuid().safeParse(id).success) return { success: false, error: 'invalid_input' }
  try {
    await removeAdminVocabulary(await requireAdmin(), id)
    revalidatePath('/[lang]/admin/content/vocabulary', 'page')
    return { success: true }
  } catch {
    return { success: false, error: 'delete_failed' }
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
    console.error('Teacher video library unavailable:', error instanceof Error ? error.name : 'database_error')
    throw new Error('video_load_failed')
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
    console.error('Teacher video save failed:', error instanceof Error ? error.name : 'database_error')
    return { success: false, error: 'save_failed' }
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
    console.error('Teacher video delete failed:', error instanceof Error ? error.name : 'database_error')
    return { success: false, error: 'delete_failed' }
  }
}
