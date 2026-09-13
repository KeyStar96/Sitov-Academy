import { z } from 'zod'
import type { Json, Database } from '@/supabase/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Trainer } from '@/lib/access/levels'

/** Public compatibility views are nullable to PostgREST's type generator. Validate
 * their required domain fields once at the boundary instead of asserting casts. */
const optionalText = z.string().nullable()
export const vocabularyCardSchema = z.object({
  id: z.string(), unit_id: z.string().optional(), lesson: z.string(), level: z.string(),
  word_de: z.string(), article: optionalText, plural: optionalText,
  image_url: optionalText, audio_url: optionalText, created_at: optionalText,
  translation_en: optionalText, translation_ru: optionalText, translation_uk: optionalText, translation_tr: optionalText,
  context_sentence_de: optionalText, context_sentence_en: optionalText, context_sentence_ru: optionalText,
  context_sentence_uk: optionalText, context_sentence_tr: optionalText,
  sentence_practice: z.boolean(), is_hard_for_ru: z.boolean().nullable(), is_hard_for_tr: z.boolean().nullable(),
  alternative_answers_de: z.array(z.string()),
})
export type VocabularyContentRow = z.infer<typeof vocabularyCardSchema>

function isJson(value: unknown): value is Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJson)
  return typeof value === 'object' && value !== null && Object.values(value).every(isJson)
}
export const grammarExerciseSchema = z.object({
  id: z.string(), unit_id: z.string().optional(), lesson: z.string(), level: z.string(), topic: z.string(), type: z.string(),
  content: z.custom<Json>(isJson), hint: z.custom<Json>(isJson).nullable(),
  created_at: optionalText, solution_audio_url: optionalText,
})
export type GrammarContentRow = z.infer<typeof grammarExerciseSchema>

export async function saveLearningContent(client: SupabaseClient<Database>, trainer: Trainer, payload: Json, id?: string): Promise<Json> {
  const { data, error } = await client.rpc('save_learning_content', {
    p_trainer: trainer, p_payload: payload, p_id: id,
  })
  if (error) throw new Error(`Content save failed: ${error.code}`)
  return data
}
export async function deleteLearningContent(client: SupabaseClient<Database>, trainer: Trainer, id: string): Promise<void> {
  const { error } = await client.rpc('delete_learning_content', { p_trainer: trainer, p_id: id })
  if (error) throw new Error(`Content deletion failed: ${error.code}`)
}
