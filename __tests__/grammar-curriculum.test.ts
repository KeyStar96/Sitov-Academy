import curriculum from '@/supabase/seeds/grammar-curriculum-2026.json'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import { grammarWriteSchema } from '@/lib/grammar-validation'
import { GRAMMAR_COPY, grammarTranslator } from '@/lib/grammar-i18n'
import { createGrammarSession, groupGrammarTopics } from '@/lib/grammar-session'
import type { StudentExercise } from '@/lib/types/exercise'

describe('Original grammar curriculum', () => {
  it.each(ACCESS_LEVELS)('%s contains 100 usable exercises across ten grammar topics', level => {
    const rows = curriculum.filter(row => row.level === level)
    expect(rows).toHaveLength(100)
    expect(new Set(rows.map(row => row.topic)).size).toBe(10)
    expect(rows.filter(row => row.type === 'fill_in_blank')).toHaveLength(80)
    expect(rows.filter(row => row.type === 'multiple_choice')).toHaveLength(20)
    for (const row of rows) {
      const parsed = grammarWriteSchema.safeParse(row)
      if (!parsed.success) throw new Error(`${row.id}: ${parsed.error.message}`)
      expect(row.content.options).toContain(row.content.correct_answer)
      expect(row.content.smart_hint || row.content.explanation).toBeTruthy()
    }
  })
  it('has stable unique IDs and no duplicate prompts', () => {
    expect(new Set(curriculum.map(row => row.id)).size).toBe(600)
    const prompts = curriculum.map(row => row.content.question || `${row.content.text_before}[${row.content.correct_answer}]${row.content.text_after}`)
    expect(new Set(prompts).size).toBe(600)
  })
  it('rejects unsolvable, duplicate, unsupported and unsafe authored exercises', () => {
    const first = curriculum[0]
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
    content: { question: '… Tisch', options: ['der', 'die', 'das'], correct_answer: 'der' },
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
