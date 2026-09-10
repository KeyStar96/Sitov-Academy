import { emptyVocabForm, vocabWriteSchema } from '@/lib/types/vocabulary-admin'

const valid = { ...emptyVocabForm(), word_de: 'lernen', lesson: 'Lektion 1' }
describe('vocabulary editor server validation', () => {
  it('rejects unknown fields and rejects blank mandatory values', () => {
    expect(vocabWriteSchema.safeParse({ ...valid, id: 'forged' }).success).toBe(false)
    expect(vocabWriteSchema.safeParse({ ...valid, word_de: '  ' }).success).toBe(false)
  })
  it('requires a German sentence and every localized prompt when writing practice is active', () => {
    expect(vocabWriteSchema.safeParse({ ...valid, sentence_practice: true }).success).toBe(false)
    expect(vocabWriteSchema.safeParse({ ...valid, sentence_practice: true, context_sentence_de: 'Ich lerne Deutsch.' }).success).toBe(false)
    expect(vocabWriteSchema.safeParse({ ...valid, sentence_practice: true, context_sentence_de: 'Ich lerne Deutsch.', context_sentence_uk: 'Я вивчаю німецьку.', context_sentence_en: 'I learn German.', context_sentence_ru: 'Я учу немецкий.', context_sentence_tr: 'Almanca öğreniyorum.' }).success).toBe(true)
  })
  it('preserves exact internal German punctuation, casing and spaces', () => {
    const result = vocabWriteSchema.parse({ ...valid, context_sentence_de: '  Ich lerne  Deutsch.  ' })
    expect(result.context_sentence_de).toBe('Ich lerne  Deutsch.')
  })
  it('rejects excessive content before a database mutation', () => {
    expect(vocabWriteSchema.safeParse({ ...valid, context_sentence_ru: 'a'.repeat(1001) }).success).toBe(false)
  })
})
