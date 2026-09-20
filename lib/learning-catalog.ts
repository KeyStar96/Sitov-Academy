import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json, Tables } from '@/supabase/database.types'
import { vocabularyCardSchema, grammarExerciseSchema } from './learning-content'
import { videoRecordSchema } from './video-links'
import { isCefrFamily, type PronunciationPrompt } from './pronunciation-prompts'

/** Foreign-key embeds keep content, translations and unit metadata authoritative. */
export const vocabularySelection = '*,unit:learning_units!inner(id,level,label,sort_order,is_active),translations:vocabulary_translations(*)' as const
export const grammarSelection = '*,unit:learning_units!inner(id,level,label,sort_order,is_active),translations:grammar_translations(*)' as const
// The grants table creates a second PostgREST path to levels; select the unit FK explicitly.
export const readingSelection = '*,unit:learning_units!inner(id,level,label,sort_order,is_active,learning_levels!learning_units_level_fkey!inner(cefr_level))' as const
export const videoSelection = '*,unit:learning_units!inner(id,level,label,sort_order,is_active)' as const
export const vocabularyQuery = (client: SupabaseClient<Database>) => client.from('learning_vocabulary_cards').select(vocabularySelection)
export const grammarQuery = (client: SupabaseClient<Database>) => client.from('learning_exercises').select(grammarSelection)
export const readingQuery = (client: SupabaseClient<Database>) => client.from('learning_reading_texts').select(readingSelection)
export const videoQuery = (client: SupabaseClient<Database>) => client.from('learning_videos').select(videoSelection)

type Unit = Pick<Tables<'learning_units'>, 'id' | 'level' | 'label' | 'sort_order' | 'is_active'>
type VocabularyRow = Tables<'learning_vocabulary_cards'> & { unit: Unit; translations: Tables<'vocabulary_translations'>[] }
type GrammarRow = Tables<'learning_exercises'> & { unit: Unit; translations: (Tables<'grammar_translations'> & { prompt?: string | null })[] }
type ReadingRow = Tables<'learning_reading_texts'> & { unit: Unit & { learning_levels: Pick<Tables<'learning_levels'>, 'cefr_level'> } }
type VideoRow = Tables<'learning_videos'> & { unit: Unit }

export function mapVocabularyCard(row: VocabularyRow) {
  const translation = (locale: string) => row.translations.find(item => item.locale === locale)
  return vocabularyCardSchema.parse({
    ...row, unit_id: row.unit.id, level: row.unit.level, lesson: row.unit.label,
    translation_en: translation('en')?.translation ?? null, translation_ru: translation('ru')?.translation ?? null,
    translation_uk: translation('uk')?.translation ?? null, translation_tr: translation('tr')?.translation ?? null,
    context_sentence_de: translation('de')?.context_sentence ?? null, context_sentence_en: translation('en')?.context_sentence ?? null,
    context_sentence_ru: translation('ru')?.context_sentence ?? null, context_sentence_uk: translation('uk')?.context_sentence ?? null,
    context_sentence_tr: translation('tr')?.context_sentence ?? null,
    is_hard_for_ru: translation('ru')?.is_difficult ?? false, is_hard_for_tr: translation('tr')?.is_difficult ?? false,
  })
}

export function mapGrammarExercise(row: GrammarRow) {
  const localized = (field: 'hint' | 'smart_hint' | 'explanation' | 'prompt') => Object.fromEntries(
    row.translations.flatMap(item => typeof item[field] === 'string' && item[field]!.trim() ? [[item.locale, item[field]!]] : []),
  )
  const content = row.content
  if (!content || typeof content !== 'object' || Array.isArray(content)) throw new Error('Invalid grammar content')
  const translated: Record<string, Json> = {}
  for (const field of ['smart_hint', 'explanation'] as const) {
    const values = localized(field)
    if (Object.keys(values).length) translated[field] = values
  }
  const hint = localized('hint')
  const prompts = localized('prompt')
  return grammarExerciseSchema.parse({ ...row, unit_id: row.unit.id, level: row.unit.level, lesson: row.unit.label,
    ...(Object.keys(prompts).length ? { translation_prompt: prompts } : {}),
    content: { ...content, ...translated }, hint: Object.keys(hint).length ? hint : null })
}

export function mapReadingText(row: ReadingRow): PronunciationPrompt {
  if (!isCefrFamily(row.unit.learning_levels.cefr_level)) throw new Error('Invalid reading level')
  return { id: row.id, unitId: row.unit.id, cefrLevel: row.unit.learning_levels.cefr_level,
    level: row.unit.level, title: row.unit.label, lesson: row.unit.label,
    sentenceDe: row.sentence_de, focus: row.focus, audioUrl: row.audio_url,
    sortOrder: row.unit.sort_order, isActive: row.unit.is_active }
}

export function mapVideo(row: VideoRow) {
  return videoRecordSchema.parse({ ...row, unit_id: row.unit.id, level: row.unit.level,
    title: row.title ?? row.unit.label, is_active: row.unit.is_active })
}
