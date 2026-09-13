'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { currentUserHasTrainerAccess, loadLevelAccessProfile } from '@/lib/access/server'
import { ACCESS_LEVELS, getAllowedLessons } from '@/lib/access/levels'
import { saveLearningContent } from '@/lib/learning-content'
import { cefrFamilyFromLevel, isCefrFamily, type PronunciationPrompt } from '@/lib/pronunciation-prompts'
import type { PronunciationMutationResult } from '@/lib/pronunciation-conversations'
import type { Tables } from '@/supabase/database.types'

type PromptRow = Tables<'pronunciation_prompts'>
function mapPrompt(row: PromptRow): PronunciationPrompt | null {
 if (!row.id || !row.sentence_de || !isCefrFamily(row.cefr_level)) return null
 return { id: row.id, cefrLevel: row.cefr_level, level: row.level ?? undefined, lesson: row.lesson, title: row.title ?? undefined, sentenceDe: row.sentence_de, focus: row.focus, audioUrl: row.audio_url, sortOrder: row.sort_order, isActive: row.is_active }
}
export async function getPronunciationPrompts(level: string): Promise<PronunciationPrompt[]> {
 try {
  if (!(await currentUserHasTrainerAccess(level, 'pronunciation'))) return []
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const accessProfile = await loadLevelAccessProfile(supabase, user.id)
  const allowedLessons = getAllowedLessons(accessProfile, level, 'pronunciation')

  const { data, error } = await supabase.from('pronunciation_prompts').select('*').eq('level', level).eq('is_active', true).order('sort_order')
  if (error) { console.error('Loading pronunciation texts failed', { level, message: error.message }); return [] }
  return (data ?? []).map(mapPrompt).filter((prompt): prompt is PronunciationPrompt => prompt !== null && (!allowedLessons || allowedLessons.includes(prompt.id)))
 } catch (error) { console.error('Loading pronunciation texts failed', error); return [] }
}
export interface SavePronunciationPromptInput { id?: string; level: string; lesson?: string; title: string; text: string; focus: string; isActive: boolean }
const promptSchema = z.object({ id: z.uuid().optional(), level: z.enum(ACCESS_LEVELS), lesson: z.string().trim().min(3).max(120).optional(), title: z.string().trim().min(3).max(120), text: z.string().trim().min(80).max(3000), focus: z.string().trim().max(200), isActive: z.boolean() })
async function staffClient() {
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()
 if (!user) return null
 const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
 return data?.role === 'teacher' || data?.role === 'admin' ? supabase : null
}
export async function getAdminPronunciationPrompts(): Promise<PronunciationPrompt[]> {
 try {
  const supabase = await staffClient()
  if (!supabase) return []
  const { data, error } = await supabase.from('pronunciation_prompts').select('*').order('level').order('sort_order')
  if (error) { console.error('Loading pronunciation CMS failed', error.message); return [] }
  return (data ?? []).map(mapPrompt).filter((prompt): prompt is PronunciationPrompt => prompt !== null)
 } catch (error) { console.error('Loading pronunciation CMS failed', error); return [] }
}
export async function savePronunciationPrompt(input: SavePronunciationPromptInput): Promise<PronunciationMutationResult> {
 const parsed = promptSchema.safeParse(input)
 if (!parsed.success) return { success: false, reason: 'invalid_input' }
 try {
  const supabase = await staffClient()
  if (!supabase) return { success: false, reason: 'not_authenticated' }
  const value = parsed.data
  const payload = { level: value.level, ...(value.lesson ? { lesson: value.lesson } : {}), cefr_level: cefrFamilyFromLevel(value.level)!, title: value.title, sentence_de: value.text, focus: value.focus || null, is_active: value.isActive }
  const data = z.object({ id: z.string() }).parse(await saveLearningContent(supabase, 'pronunciation', payload, value.id))
  revalidatePath('/[lang]/admin/content/pronunciation', 'page'); revalidatePath('/[lang]/dashboard/level/[level]/pronunciation', 'page')
  return { success: true, id: data.id }
 } catch (error) { console.error('Saving pronunciation text failed', error); return { success: false, reason: 'save_failed' } }
}
