import { sitovLearningSourceLocale } from '@/lib/access/sitov-learning-source'
import type { UiLocale } from '@/lib/locale-routing'
import type { VocabularyCardRow } from '@/lib/types/vocabulary'

export type VocabularySourceLanguage = Exclude<UiLocale, 'de'>

type ContextCard = Pick<VocabularyCardRow,
  'context_sentence_de' | 'context_sentence_en' | 'context_sentence_ru' | 'context_sentence_uk' | 'context_sentence_tr'>
type TranslationCard = Pick<VocabularyCardRow, 'translation_en' | 'translation_ru' | 'translation_tr'> & {
  translation_uk?: string | null
}

export interface VocabularySource {
  language: VocabularySourceLanguage
  text: string
}

/** Profiles store one validated ISO interface-language code, never a display name. */
export function vocabularyNativeLocale(value: string | null): UiLocale | null {
  return value === 'de' || value === 'en' || value === 'ru' || value === 'uk' || value === 'tr' ? value : null
}

/**
 * Non-German UI retains its existing source. German UI uses only the stored
 * valid non-German native source; missing translations never invent a fallback.
 * Missing/duplicated German prompts never silently become a word exercise.
 * Original text is returned verbatim; trimming only checks content availability.
 */
export function resolveVocabularySentenceSource(
  card: ContextCard,
  uiLanguage: UiLocale,
  nativeLanguage: string | null = null,
): VocabularySource | null {
  const target = card.context_sentence_de
  const language = sitovLearningSourceLocale(uiLanguage, nativeLanguage)
  if (!target?.trim() || !language) return null
  const text = card[`context_sentence_${language}`]
  if (text?.trim() && text.trim().normalize('NFC') !== target.trim().normalize('NFC')) {
    return { language, text }
  }
  return null
}

/** Learning prompts must never switch language because a translation is absent. */
export function resolveVocabularyInterfaceTranslation(card: TranslationCard, uiLanguage: UiLocale, nativeLanguage: string | null = null): VocabularySource | null {
  const language = sitovLearningSourceLocale(uiLanguage, nativeLanguage)
  if (!language) return null
  const text = card[`translation_${language}`]
  return text?.trim() ? { language, text } : null
}

/**
 * Wie oben — nur „Eigene Wörter" (Migration 23) haben eine Ausnahme: Sie tragen
 * genau eine Übersetzung, in der Sprache, in der sie eingetragen wurden. Nach
 * einem Sprachwechsel der Oberfläche gilt sie weiter, mit ihrer echten Sprache
 * (lang-Attribut, Vorlesen). Spiegelt vocabulary_private.card_translation, die
 * auch die Bewertung in PostgreSQL so auflöst — gleiche Reihenfolge.
 */
export function resolveCardInterfaceTranslation(card: TranslationCard & { is_own?: boolean }, uiLanguage: UiLocale, nativeLanguage: string | null = null): VocabularySource | null {
  const exact = resolveVocabularyInterfaceTranslation(card, uiLanguage, nativeLanguage)
  if (exact || !card.is_own || uiLanguage === 'de') return exact
  for (const language of ['en', 'ru', 'tr', 'uk'] as const) {
    const text = card[`translation_${language}`]
    if (text?.trim()) return { language, text }
  }
  return null
}

/** Resolve both the text and its actual language so labels never misstate a fallback. */
export function resolveVocabularyTranslation(card: TranslationCard, nativeLanguage: string | null): VocabularySource | null {
  const nativeLocale = vocabularyNativeLocale(nativeLanguage)
  const candidates: VocabularySourceLanguage[] = [
    ...(nativeLocale && nativeLocale !== 'de' ? [nativeLocale] : []), 'en', 'ru', 'tr', 'uk',
  ]
  for (const language of new Set(candidates)) {
    const text = card[`translation_${language}`]
    if (text?.trim()) return { language, text }
  }
  return null
}
