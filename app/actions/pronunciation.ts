'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { readingQuery, mapReadingText } from '@/lib/learning-catalog'
import { createClient } from '@/utils/supabase/server'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { SITOV_PLATFORM_LEVELS, getAllowedLessons, hasTrainerAccess, isAccessLevel } from '@/lib/access/levels'
import { requestSession } from '@/lib/request-session'
import { saveLearningContent } from '@/lib/learning-writes'
import { SitovPreparedAudioRequiredError } from '@/lib/audio/prepared-content'
import { type PronunciationPrompt } from '@/lib/pronunciation-prompts'
import type { PronunciationMutationResult } from '@/lib/pronunciation-conversations'
import { loadSitovPronunciationReadiness } from '@/lib/sitov-pronunciation-readiness-server'

export async function getPronunciationPrompts(level: string): Promise<PronunciationPrompt[]> {
 try {
  const { supabase, user } = await requestSession()
  if (!user) return []
  const accessProfile = await loadLevelAccessProfile(supabase, user.id)
  if (!hasTrainerAccess(accessProfile, level, 'pronunciation')) return []
  const allowedLessons = getAllowedLessons(accessProfile, level, 'pronunciation')
  const readiness = await loadSitovPronunciationReadiness(supabase, level)
  if (!readiness) return []
  const readyIds = readiness.texts.filter(text => text.ready).map(text => text.id)
  // The readiness metadata also drives the locked-text UI. Do not scan text
  // bodies (and repeat their evidence-based RLS checks) when none are ready.
  if (!readyIds.length) return []

  const { data, error } = await readingQuery(supabase).in('id', readyIds).eq('unit.level', level).eq('unit.is_active', true).order('sort_order', { referencedTable: 'unit' })
  if (error) { console.error("Loading pronunciation texts failed"); return [] }
  return (data ?? []).map(mapReadingText).filter((prompt): prompt is PronunciationPrompt => prompt !== null && readyIds.includes(prompt.id) && (!allowedLessons || allowedLessons.includes(prompt.unitId)))
 } catch (error) { console.error("Loading pronunciation texts failed"); return [] }
}
export interface SavePronunciationPromptInput { id?: string; level: string; title: string; text: string; focus: string; isActive: boolean }
const promptSchema = z.object({ id: z.uuid().optional(), level: z.enum([...SITOV_PLATFORM_LEVELS, 'B2', 'C1', 'C2']), title: z.string().trim().min(3).max(120), text: z.string().trim().min(1).max(3000), focus: z.string().trim().max(200), isActive: z.boolean() })
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
  const { data, error } = await readingQuery(supabase).order('id')
  if (error) { console.error("Loading pronunciation CMS failed"); return [] }
  return (data ?? []).map(mapReadingText).filter((prompt): prompt is PronunciationPrompt => prompt !== null)
 } catch (error) { console.error("Loading pronunciation CMS failed"); return [] }
}
export async function savePronunciationPrompt(input: SavePronunciationPromptInput): Promise<PronunciationMutationResult> {
 const parsed = promptSchema.safeParse(input)
 if (!parsed.success || (parsed.data.isActive && !isAccessLevel(parsed.data.level))) return { success: false, reason: 'invalid_input' }
 try {
  const supabase = await staffClient()
  if (!supabase) return { success: false, reason: 'not_authenticated' }
  const value = parsed.data
  const payload = { level: value.level, title: value.title, sentence_de: value.text, focus: value.focus || null, is_active: value.isActive }
  const data = z.object({ id: z.string() }).parse(await saveLearningContent(supabase, 'pronunciation', payload, value.id))
  revalidatePath('/[lang]/admin/content/pronunciation', 'page'); revalidatePath('/[lang]/dashboard/level/[level]/pronunciation', 'page')
  return { success: true, id: data.id }
 } catch (error) {
  if (error instanceof SitovPreparedAudioRequiredError) return { success: false, reason: 'missing_audio' }
  console.error("Saving pronunciation text failed"); return { success: false, reason: 'save_failed' }
 }
}
