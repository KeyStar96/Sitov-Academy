import { resolveVocabularySentenceSource, resolveVocabularyTranslation, vocabularyNativeLocale } from '@/lib/vocabulary-languages'

const contexts = {
  context_sentence_de: 'Ich öffne die Tür.',
  context_sentence_en: 'I open the door.',
  context_sentence_ru: 'Я открываю дверь.',
  context_sentence_uk: 'Я відчиняю двері.',
  context_sentence_tr: 'Kapıyı açıyorum.',
}

describe('sentence source language matrix', () => {
  it.each(['en', 'ru', 'uk', 'tr'] as const)('uses exactly %s UI regardless of the native language', language => {
    for (const native of ['Deutsch', 'Russisch', 'Türkisch', 'Ukrainisch', 'Englisch', null]) {
      expect(resolveVocabularySentenceSource(contexts, language, native)).toEqual({
        language, text: contexts[`context_sentence_${language}`],
      })
    }
  })
  it.each([
    ['Russisch', 'ru'], ['ru', 'ru'], ['Türkisch', 'tr'], ['tr', 'tr'],
    ['Ukrainisch', 'uk'], ['uk', 'uk'], ['Englisch', 'en'], ['en', 'en'],
  ] as const)('uses foreign native language %s for German UI', (native, language) => {
    expect(resolveVocabularySentenceSource(contexts, 'de', native)).toEqual({
      language, text: contexts[`context_sentence_${language}`],
    })
  })
  it.each(['Deutsch', 'de', 'Andere', 'Polnisch', null])('defaults German UI / %s to Russian', native => {
    expect(resolveVocabularySentenceSource(contexts, 'de', native)).toEqual({ language: 'ru', text: contexts.context_sentence_ru })
  })
  it('uses available foreign fallbacks only for German UI', () => {
    const partial = { ...contexts, context_sentence_tr: null, context_sentence_ru: '  ' }
    expect(resolveVocabularySentenceSource(partial, 'de', 'Türkisch')).toEqual({ language: 'en', text: contexts.context_sentence_en })
    expect(resolveVocabularySentenceSource(partial, 'tr', 'Englisch')).toBeNull()
    expect(resolveVocabularySentenceSource(partial, 'ru', 'Englisch')).toBeNull()
  })
  it('never returns the German target as a source, even when copied into a foreign column', () => {
    const copied = { ...contexts, context_sentence_ru: ` ${contexts.context_sentence_de} ` }
    expect(resolveVocabularySentenceSource(copied, 'de', 'Russisch')?.language).toBe('en')
    expect(resolveVocabularySentenceSource(copied, 'ru', 'Russisch')).toBeNull()
    expect(resolveVocabularySentenceSource({ ...copied, context_sentence_en: null, context_sentence_tr: null, context_sentence_uk: null }, 'de', null)).toBeNull()
  })
  it('requires the German target but preserves all original source bytes', () => {
    expect(resolveVocabularySentenceSource({ ...contexts, context_sentence_de: ' ' }, 'ru', null)).toBeNull()
    const source = '  Я открываю дверь.\n'
    expect(resolveVocabularySentenceSource({ ...contexts, context_sentence_ru: source }, 'de', null)?.text).toBe(source)
  })
})

it('reports the real word translation language, including missing native translations', () => {
  const card = { translation_en: 'door', translation_ru: 'дверь', translation_tr: 'kapı', translation_uk: 'двері' }
  expect(resolveVocabularyTranslation(card, 'tr')).toEqual({ language: 'tr', text: 'kapı' })
  expect(resolveVocabularyTranslation({ ...card, translation_tr: '' }, 'Türkisch')).toEqual({ language: 'en', text: 'door' })
  expect(vocabularyNativeLocale(' УКРАЇНСЬКА ')).toBe('uk')
})
