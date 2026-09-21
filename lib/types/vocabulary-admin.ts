import { z } from 'zod'
import type { VocabularyCardRow } from '@/lib/types/vocabulary'

const shortText = z.string().trim().max(500)
const sentence = z.string().trim().max(1000)
export const vocabWriteSchema = z.object({
  level: z.enum(['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2']),
  lesson: z.string().trim().min(1).max(120),
  word_de: z.string().trim().min(1).max(300),
  article: z.enum(['none', 'der', 'die', 'das']),
  plural: shortText,
  translation_ru: shortText,
  translation_tr: shortText,
  translation_en: shortText,
  translation_uk: shortText,
  context_sentence_de: sentence,
  context_sentence_en: sentence,
  context_sentence_ru: sentence,
  context_sentence_uk: sentence,
  context_sentence_tr: sentence,
  sentence_practice: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.sentence_practice && ![value.context_sentence_de, value.context_sentence_en, value.context_sentence_ru, value.context_sentence_uk, value.context_sentence_tr].every(Boolean)) {
    context.addIssue({ code: 'custom', path: ['sentence_practice'], message: 'sentence_context_required' })
  }
})
export type VocabWriteInput = z.infer<typeof vocabWriteSchema>
/** `code` trägt den maschinenlesbaren RPC-/SQLSTATE-Code (R10). */
export type VocabSaveResult = { success: true; data: VocabularyCardRow } | { success: false; error: 'invalid_input' | 'save_failed'; code?: string }

export function emptyVocabForm(): VocabWriteInput {
  return { level: 'A1.1', lesson: '', word_de: '', article: 'none', plural: '', translation_ru: '', translation_tr: '', translation_en: '', translation_uk: '', context_sentence_de: '', context_sentence_en: '', context_sentence_ru: '', context_sentence_uk: '', context_sentence_tr: '', sentence_practice: false }
}
export function vocabToForm(card: VocabularyCardRow): VocabWriteInput {
  const candidate = { ...emptyVocabForm(), level: card.level, lesson: card.lesson, word_de: card.word_de, article: card.article || 'none', plural: card.plural || '', translation_ru: card.translation_ru || '', translation_en: card.translation_en || '', translation_tr: card.translation_tr || '', translation_uk: card.translation_uk || '', context_sentence_de: card.context_sentence_de || '', context_sentence_en: card.context_sentence_en || '', context_sentence_ru: card.context_sentence_ru || '', context_sentence_uk: card.context_sentence_uk || '', context_sentence_tr: card.context_sentence_tr || '', sentence_practice: card.sentence_practice }
  const parsed = vocabWriteSchema.safeParse(candidate)
  return parsed.success ? parsed.data : { ...candidate, level: 'A1.1', article: 'none', sentence_practice: false }
}
