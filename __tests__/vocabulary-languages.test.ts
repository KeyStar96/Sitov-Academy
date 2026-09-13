import { resolveVocabularySentenceSource, resolveVocabularyTranslation, resolveVocabularyInterfaceTranslation, vocabularyNativeLocale } from '@/lib/vocabulary-languages'

const contexts = {
  context_sentence_de: 'Ich öffne die Tür.',
  context_sentence_en: 'I open the door.',
  context_sentence_ru: 'Я открываю дверь.',
  context_sentence_uk: 'Я відчиняю двері.',
  context_sentence_tr: 'Kapıyı açıyorum.',
}

describe('sentence source language matrix', () => {
  it.each(['en', 'ru', 'uk', 'tr'] as const)('uses exactly %s UI regardless of the native language', language => {
    for (const native of ['de', 'ru', 'tr', 'uk', 'en', null]) {
      expect(resolveVocabularySentenceSource(contexts, language, native)).toEqual({
        language, text: contexts[`context_sentence_${language}`],
      })
    }
  })
  it.each(['de', 'de', 'ru', 'tr', 'uk', 'en', null])('blocks German UI regardless of native language %s', native => {
    expect(resolveVocabularySentenceSource(contexts, 'de', native)).toBeNull()
  })
  it('does not substitute a different language when the UI translation is missing', () => {
    const partial = { ...contexts, context_sentence_tr: null, context_sentence_ru: '  ' }
    expect(resolveVocabularySentenceSource(partial, 'tr', 'en')).toBeNull()
    expect(resolveVocabularySentenceSource(partial, 'ru', 'en')).toBeNull()
  })
  it('never returns the German target as a source, even when copied into a foreign column', () => {
    const copied = { ...contexts, context_sentence_ru: ` ${contexts.context_sentence_de} ` }
    expect(resolveVocabularySentenceSource(copied, 'de', 'ru')).toBeNull()
    expect(resolveVocabularySentenceSource(copied, 'ru', 'ru')).toBeNull()
    expect(resolveVocabularySentenceSource({ ...copied, context_sentence_en: null, context_sentence_tr: null, context_sentence_uk: null }, 'de', null)).toBeNull()
  })
  it('requires the German target but preserves all original source bytes', () => {
    expect(resolveVocabularySentenceSource({ ...contexts, context_sentence_de: ' ' }, 'ru', null)).toBeNull()
    const source = '  Я открываю дверь.\n'
    expect(resolveVocabularySentenceSource({ ...contexts, context_sentence_ru: source }, 'ru', null)?.text).toBe(source)
  })
})

it('reports the real word translation language, including missing native translations', () => {
  const card = { translation_en: 'door', translation_ru: 'дверь', translation_tr: 'kapı', translation_uk: 'двері' }
  expect(resolveVocabularyTranslation(card, 'tr')).toEqual({ language: 'tr', text: 'kapı' })
  expect(resolveVocabularyTranslation({ ...card, translation_tr: '' }, 'tr')).toEqual({ language: 'en', text: 'door' })
  expect(vocabularyNativeLocale('uk')).toBe('uk')
  expect(vocabularyNativeLocale('Українська')).toBeNull()
})

it.each(['en', 'ru', 'uk', 'tr'] as const)('uses %s UI for word prompts as well as sentences', language => {
  const card = { translation_en: 'door', translation_ru: 'дверь', translation_tr: 'kapı', translation_uk: 'двері' }
  expect(resolveVocabularyInterfaceTranslation(card, language)).toEqual({ language, text: card[`translation_${language}`] })
  expect(resolveVocabularyInterfaceTranslation({ ...card, [`translation_${language}`]: '' }, language)).toBeNull()
  expect(resolveVocabularyInterfaceTranslation(card, 'de')).toBeNull()
})
