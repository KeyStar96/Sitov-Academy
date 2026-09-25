import { z } from 'zod'
import { getRpcError } from './rpc-errors'
import type { Json, Database } from '@/supabase/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Trainer } from './access/levels'
import { vocabularyQuery, grammarQuery, readingQuery, videoQuery, mapVocabularyCard, mapGrammarExercise, mapReadingText, mapVideo } from './learning-catalog'

const locales = ['de', 'en', 'ru', 'uk', 'tr'] as const
function jsonObject(value: Json | undefined): Record<string, Json | undefined> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid content object')
  return value
}
function localized(value: Json | undefined, locale: string): Json {
  return typeof value === 'string' ? (locale === 'de' ? value : null)
    : value && typeof value === 'object' && !Array.isArray(value) ? value[locale] ?? null : null
}

/** Map a validated editor form to the normalized write contract, not to a view. */
export function learningWritePayload(trainer: Trainer, input: Json): Json {
  const form = jsonObject(input)
  const unit: Record<string, Json> = { level: form.level ?? null,
    label: (trainer === 'vocabulary' || trainer === 'exercises' ? form.lesson : form.title) ?? null }
  for (const key of ['is_active', 'sort_order']) if (form[key] !== undefined) unit[key] = form[key]
  const fieldNames: Record<Trainer, string[]> = {
    vocabulary: ['word_de', 'article', 'plural', 'image_url', 'audio_url', 'sentence_practice', 'alternative_answers_de', 'target_form'],
    exercises: ['topic', 'type', 'content', 'solution_audio_url'], pronunciation: ['sentence_de', 'focus', 'audio_url'],
    videos: ['description', 'source_url', 'title', 'folder_id', 'storage_path', 'file_size'],
  }
  const fields: Record<string, Json> = {}
  for (const key of fieldNames[trainer]) if (form[key] !== undefined) fields[key] = form[key]
  let translations: Json[] = []
  if (trainer === 'vocabulary') translations = locales.map(locale => ({ locale,
    translation: form[`translation_${locale}`] ?? null, context_sentence: form[`context_sentence_${locale}`] ?? null,
    is_difficult: form[`is_hard_for_${locale}`] ?? false }))
  if (trainer === 'exercises') {
    const { smart_hint, explanation, ...content } = jsonObject(form.content)
    fields.content = content
    translations = locales.map(locale => ({ locale, hint: localized(form.hint, locale),
      prompt: localized(form.translation_prompt, locale),
      smart_hint: localized(smart_hint, locale), explanation: localized(explanation, locale) }))
  }
  return { unit, fields, translations }
}

export async function saveLearningContent(client: SupabaseClient<Database>, trainer: Trainer, payload: Json, id?: string): Promise<Json> {
  const { data, error } = await client.rpc('save_learning_content', { p_trainer: trainer, p_payload: learningWritePayload(trainer, payload), p_id: id })
  if (error) throw new Error(`Content save failed: ${error.code}`)
  const failure = getRpcError(data)
  if (failure) throw new Error(`Content save failed: ${failure.error}`)
  const saved = z.object({ id: z.string().uuid() }).parse(data)
  if (trainer === 'vocabulary') {
    const row = await vocabularyQuery(client).eq('id', saved.id).single()
    if (row.error) throw row.error
    return mapVocabularyCard(row.data)
  }
  if (trainer === 'exercises') {
    const row = await grammarQuery(client).eq('id', saved.id).single()
    if (row.error) throw row.error
    return mapGrammarExercise(row.data)
  }
  if (trainer === 'pronunciation') {
    const row = await readingQuery(client).eq('id', saved.id).single()
    if (row.error) throw row.error
    const prompt = mapReadingText(row.data)
    return { id: prompt.id }
  }
  const row = await videoQuery(client).eq('id', saved.id).single()
  if (row.error) throw row.error
  return mapVideo(row.data)
}

export async function deleteLearningContent(client: SupabaseClient<Database>, trainer: Trainer, id: string): Promise<void> {
  const { data, error } = await client.rpc('delete_learning_content', { p_trainer: trainer, p_id: id })
  if (error) throw new Error(`Content deletion failed: ${error.code}`)
  const failure = getRpcError(data)
  if (failure) throw new Error(`Content deletion failed: ${failure.error}`)
}
