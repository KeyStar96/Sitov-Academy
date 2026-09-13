import type { VocabularyContentRow } from '@/lib/learning-content'

/** Authored test content, represented as the real PostgREST FK-join response. */
export function vocabularyDatabaseRow(card: VocabularyContentRow) {
  const unitId = card.unit_id ?? '90000000-0000-4000-8000-000000000001'
  return {
    id: card.id, unit_id: unitId, word_de: card.word_de, article: card.article, plural: card.plural,
    audio_url: card.audio_url, image_url: card.image_url, created_at: card.created_at,
    sentence_practice: card.sentence_practice, alternative_answers_de: card.alternative_answers_de,
    unit: { id: unitId, level: card.level, label: card.lesson, sort_order: 1, is_active: true },
    translations: [
      { card_id: card.id, locale: 'de', translation: null, context_sentence: card.context_sentence_de, is_difficult: false },
      { card_id: card.id, locale: 'en', translation: card.translation_en, context_sentence: card.context_sentence_en, is_difficult: false },
      { card_id: card.id, locale: 'ru', translation: card.translation_ru, context_sentence: card.context_sentence_ru, is_difficult: card.is_hard_for_ru ?? false },
      { card_id: card.id, locale: 'uk', translation: card.translation_uk, context_sentence: card.context_sentence_uk, is_difficult: false },
      { card_id: card.id, locale: 'tr', translation: card.translation_tr, context_sentence: card.context_sentence_tr, is_difficult: card.is_hard_for_tr ?? false },
    ],
  }
}
