import { learningWritePayload } from '@/lib/learning-writes'
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

it('validates optional target forms and equivalent answers without changing German forms', () => {
  expect(vocabWriteSchema.parse({ ...valid, target_form: [' heißen ', 'Sie'], alternative_answers_de: [' Mein Name ist Anna. '] })).toMatchObject({ target_form: ['heißen', 'Sie'], alternative_answers_de: ['Mein Name ist Anna.'] })
  for (const target_form of [[''], ['x'.repeat(121)], Array(13).fill('lernen')]) expect(vocabWriteSchema.safeParse({ ...valid, target_form }).success).toBe(false)
  expect(vocabWriteSchema.safeParse({ ...valid, alternative_answers_de: [''] }).success).toBe(false)
})


it('preserves omitted sentence metadata through legacy CMS payload validation and RPC mapping', () => {
  const legacy = { ...valid }
  delete legacy.target_form
  delete legacy.alternative_answers_de
  const parsed = vocabWriteSchema.parse(legacy)
  const payload = learningWritePayload('vocabulary', parsed) as { fields: Record<string, unknown> }
  expect(payload.fields).not.toHaveProperty('target_form')
  expect(payload.fields).not.toHaveProperty('alternative_answers_de')
  // Clearing is intentional only when the editor explicitly supplies empty arrays.
  const clear = learningWritePayload('vocabulary', vocabWriteSchema.parse({ ...legacy, target_form: [], alternative_answers_de: [] })) as { fields: Record<string, unknown> }
  expect(clear.fields).toMatchObject({ target_form: [], alternative_answers_de: [] })
})
