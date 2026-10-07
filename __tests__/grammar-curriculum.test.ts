import curriculum from '@/supabase/seeds/grammar-curriculum-2026.json'
import { grammarWriteSchema } from '@/lib/grammar-validation'

const authored = {
  level: 'A1.1', lesson: '01', topic: 'Sein', type: 'fill_in_blank', solution_audio_url: null,
  content: { target_form: ['sein'], text_before: 'Ich ', text_after: ' neu im Deutschkurs.', correct_answer: 'bin',
    options: ['bin', 'bist', 'ist'], smart_hint: 'Das Verb passt zur Person.' },
}

/** The historical seed covers the levels of its time; B2.1 … C1.2 get their grammar from the learning path. */
const CURRICULUM_LEVELS = ['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2'] as const

describe('Original grammar curriculum', () => {
  it.each(CURRICULUM_LEVELS)('%s preserves 100 historical exercises that need authored target forms before reuse', level => {
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
})

describe('Authored grammar data validation', () => {
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
