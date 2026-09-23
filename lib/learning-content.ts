import { z } from 'zod'
import type { Json } from '@/supabase/database.types'

/** Validated UI content contracts assembled from canonical table relationships. */
const optionalText = z.string().nullable()
export const vocabularyCardSchema = z.object({
  id: z.string(), unit_id: z.string().uuid(), lesson: z.string(), level: z.string(),
  word_de: z.string(), article: optionalText, plural: optionalText,
  image_url: optionalText, audio_url: optionalText, created_at: optionalText,
  translation_en: optionalText, translation_ru: optionalText, translation_uk: optionalText, translation_tr: optionalText,
  context_sentence_de: optionalText, context_sentence_en: optionalText, context_sentence_ru: optionalText,
  context_sentence_uk: optionalText, context_sentence_tr: optionalText,
  sentence_practice: z.boolean(), is_hard_for_ru: z.boolean().nullable(), is_hard_for_tr: z.boolean().nullable(),
  alternative_answers_de: z.array(z.string()),
  /** „Eigene Wörter" einer lernenden Person (Migration 23), nie Kursinhalt. */
  is_own: z.boolean().optional(),
})
export type VocabularyContentRow = z.infer<typeof vocabularyCardSchema>

function isJson(value: unknown): value is Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJson)
  return typeof value === 'object' && value !== null && Object.values(value).every(isJson)
}
export const grammarExerciseSchema = z.object({
  id: z.string(), unit_id: z.string().uuid(), lesson: z.string(), level: z.string(), topic: z.string(), type: z.string(),
  content: z.custom<Json>(isJson), hint: z.custom<Json>(isJson).nullable(),
  translation_prompt: z.record(z.string(), z.string()).optional(),
  content_status: z.enum(['incomplete', 'ready']).optional(),
  created_at: optionalText, solution_audio_url: optionalText,
})
export type GrammarContentRow = z.infer<typeof grammarExerciseSchema>
