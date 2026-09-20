import curriculum from '@/supabase/seeds/grammar-curriculum-2026.json'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import { grammarWriteSchema } from '@/lib/grammar-validation'
import { GRAMMAR_COPY, grammarTranslator } from '@/lib/grammar-i18n'
import { createGrammarSession, groupGrammarTopics } from '@/lib/grammar-session'
import type { StudentExercise } from '@/lib/types/exercise'

const authored = {
  level: 'A1.1', lesson: '01', topic: 'Sein', type: 'fill_in_blank', solution_audio_url: null,
  content: { target_form: ['sein'], text_before: 'Ich ', text_after: ' neu im Deutschkurs.', correct_answer: 'bin',
    options: ['bin', 'bist', 'ist'], smart_hint: 'Das Verb passt zur Person.' },
}

describe('Original grammar curriculum', () => {
  it.each(ACCESS_LEVELS)('%s preserves 100 historical exercises that need authored target forms before reuse', level => {
    const rows = curriculum.filter(row => row.level === level)
    expect(rows).toHaveLength(100)
    expect(new Set(rows.map(row => row.topic)).size).toBe(10)
    expect(rows.filter(row => row.type === 'fill_in_blank')).toHaveLength(80)
    expect(rows.filter(row => row.type === 'multiple_choice')).toHaveLength(20)
    for (const row of rows) {
      const parsed = grammarWriteSchema.safeParse(row)
      expect(parsed.success).toBe(false)
      if (!parsed.success) expect(parsed.error.issues.map(issue => issue.path)).toEqual([['content', 'target_form']])
      expect(row.content.options).toContain(row.content.correct_answer)
      expect(new Set(row.content.options.map(value => value.trim().toLocaleLowerCase('de-DE'))).size).toBe(row.content.options.length)
      expect(row.content.smart_hint || row.content.explanation).toBeTruthy()
    }
  })
  it('has stable unique IDs and no duplicate prompts', () => {
    expect(new Set(curriculum.map(row => row.id)).size).toBe(600)
    const prompts = curriculum.map(row => row.content.question || `${row.content.text_before}[${row.content.correct_answer}]${row.content.text_after}`)
    expect(new Set(prompts).size).toBe(600)
  })
  it('rejects unsolvable, duplicate, unsupported and unsafe authored exercises', () => {
    const first = authored
    for (const content of [
      { ...first.content, options: ['falsch', 'auch falsch'] },
      { ...first.content, options: [first.content.correct_answer, ` ${first.content.correct_answer.toUpperCase()} `] },
      { ...first.content, text_before: '', text_after: '' },
    ]) expect(grammarWriteSchema.safeParse({ ...first, content }).success).toBe(false)
    expect(grammarWriteSchema.safeParse({ ...first, level: 'C9' }).success).toBe(false)
    expect(grammarWriteSchema.safeParse({ ...first, solution_audio_url: 'javascript:alert(1)' }).success).toBe(false)
    expect(grammarWriteSchema.safeParse({ ...first, type: 'sentence_building' }).success).toBe(false)
  })
  it.each(['de', 'en', 'ru', 'uk', 'tr'] as const)('has complete studio and editor labels in %s', lang => {
    expect(Object.keys(GRAMMAR_COPY[lang]).sort()).toEqual(Object.keys(GRAMMAR_COPY.de).sort())
    expect(grammarTranslator(lang)('topicProgress', { done: 2, total: 10 })).not.toMatch(/\{\w+\}/)
  })
})

function exercise(index: number, completed = false, topic = 'Artikel'): StudentExercise {
  return { id: String(index), lesson: '01', topic, level: 'A1.1', type: 'multiple_choice',
    content: { target_form: ['bestimmter Artikel'], question: '… Tisch', options: ['der', 'die', 'das'], correct_answer: 'der' },
    completed, score: 0, attempts: 0, hint: null }
}
describe('Grammar sessions', () => {
  const exercises = [exercise(0, true), ...Array.from({ length: 15 }, (_, index) => exercise(index + 1)), exercise(20, false, 'Verben')]
  it('limits sessions to ten unfinished exercises without mutating the library', () => {
    const session = createGrammarSession(exercises)
    expect(session).toHaveLength(10)
    expect(session[0].id).toBe('1')
    expect(exercises[0].completed).toBe(true)
  })
  it('keeps topic boundaries and allows completed material to be reviewed', () => {
    expect(createGrammarSession(exercises, { topic: 'Verben' }).map(row => row.id)).toEqual(['20'])
    expect(createGrammarSession([exercise(0, true)])).toHaveLength(0)
    expect(createGrammarSession([exercise(0, true)], { review: true })).toHaveLength(1)
    expect(createGrammarSession(exercises, { topic: 'Missing' })).toHaveLength(0)
  })
  it('reports persisted progress separately for every topic', () => {
    expect(groupGrammarTopics(exercises)).toEqual([{ name: 'Artikel', total: 16, completed: 1 }, { name: 'Verben', total: 1, completed: 0 }])
  })
})

describe('Grammar CMS authored data validation', () => {
  it('accepts seed string explanations and multilingual metadata without mixing them', () => {
    const result = grammarWriteSchema.parse({ ...authored, hint: { ru: 'Сравнение', uk: 'Порівняння' } })
    expect(result.hint).toEqual({ ru: 'Сравнение', uk: 'Порівняння' })
    expect(result.content).toHaveProperty('smart_hint', authored.content.smart_hint)
    expect(result).not.toHaveProperty('hint_ru')
    expect(result).not.toHaveProperty('hint_tr')
  })
  it('validates accepted alternatives and rejects invalid or duplicated answers', () => {
    const first = authored
    expect(grammarWriteSchema.safeParse({ ...first, content: { ...first.content, alternative_answers: ['werde sein'] } }).success).toBe(true)
    for (const alternatives of [[''], ['x', ' X '], [first.content.correct_answer], Array(21).fill('x'), [3]]) {
      expect(grammarWriteSchema.safeParse({ ...first, content: { ...first.content, alternative_answers: alternatives } }).success).toBe(false)
    }
  })
  it('emits one canonical accepted_answers array, including the principal answer', () => {
    const first=authored
    const legacy=grammarWriteSchema.parse({...first,content:{...first.content,alternative_answers:['werde sein']}})
    expect(legacy.content.accepted_answers).toEqual([first.content.correct_answer,'werde sein'])
    expect(legacy.content).not.toHaveProperty('alternative_answers')
    const canonical=grammarWriteSchema.parse({...first,content:{...first.content,accepted_answers:[first.content.correct_answer]}})
    expect(canonical.content.accepted_answers).toEqual([first.content.correct_answer])
    expect(grammarWriteSchema.safeParse({...first,content:{...first.content,accepted_answers:['unrelated']}}).success).toBe(false)
  })
  it('permits a translation exercise with a localized prompt and explicit base form without inventing German lead-in text', () => {
    const exercise = grammarWriteSchema.parse({ ...authored, translation_prompt: { ru: 'Как вас зовут?' },
      content: { ...authored.content, target_form: [' heißen '], text_before: '', text_after: '', correct_answer: 'Wie heißen Sie?',
        options: ['Wie heißen Sie?', 'Wie wohnen Sie?'] } })
    expect(exercise.content.target_form).toEqual(['heißen'])
    expect(exercise.translation_prompt).toEqual({ ru: 'Как вас зовут?' })
  })
})
