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

/** Profiles historically store German language names; accept locale codes too. */
export function vocabularyNativeLocale(value: string | null): UiLocale | null {
  switch (value?.trim().toLowerCase()) {
    case 'de': case 'deutsch': case 'german': return 'de'
    case 'en': case 'englisch': case 'english': return 'en'
    case 'ru': case 'russisch': case 'russian': case 'русский': return 'ru'
    case 'uk': case 'ua': case 'ukrainisch': case 'ukrainian': case 'українська': return 'uk'
    case 'tr': case 'türkisch': case 'turkish': case 'türkçe': return 'tr'
    default: return null
  }
}

/**
 * Non-German UI locales are authoritative. German UI uses a foreign native
 * language, then Russian and the remaining available foreign contexts.
 * Missing/duplicated German prompts never silently become a word exercise.
 * Original text is returned verbatim; trimming only checks content availability.
 */
export function resolveVocabularySentenceSource(
  card: ContextCard,
  uiLanguage: UiLocale,
  nativeLanguage: string | null,
): VocabularySource | null {
  const target = card.context_sentence_de
  if (!target?.trim()) return null
  const nativeLocale = vocabularyNativeLocale(nativeLanguage)
  const candidates: VocabularySourceLanguage[] = uiLanguage !== 'de'
    ? [uiLanguage]
    : [...(nativeLocale && nativeLocale !== 'de' ? [nativeLocale] : []), 'ru', 'en', 'uk', 'tr']
  for (const language of new Set(candidates)) {
    const text = card[`context_sentence_${language}`]
    if (text?.trim() && text.trim().normalize('NFC') !== target.trim().normalize('NFC')) {
      return { language, text }
    }
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
