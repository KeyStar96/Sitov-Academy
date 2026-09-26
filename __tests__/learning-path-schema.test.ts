/** @jest-environment node */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  LEARNING_PATH_EXERCISE_TYPES, learningPathAudioReferenceSchema,
  learningPathContentSchemas, learningPathExerciseSchema, learningPathSeedSchema,
} from '@/lib/learning-path-schema'

const base = { target_form: ['Testform'], instruction: 'Prüfe die Testdaten.' }
const choice = { ...base, question: 'Welche Testoption?', options: ['Option A', 'Option B'], correct_answer: 'Option A', accepted_answers: ['Option A'] }
const gap = { ...base, text_before: 'Test ', text_after: '.', correct_answer: 'Antwort', accepted_answers: ['Antwort'], needs_article: true }
// Structural fixtures only; no additional curriculum or seed is authored here.
const validContent = {
  multiple_choice: choice,
  fill_in_blank: gap,
  multi_blank: { ...base, text: 'Test {a} und {b}.', blanks: [
    { id: 'a', accepted_answers: ['Antwort A'], needs_article: true },
    { id: 'b', label: 'Testfeld', accepted_answers: ['Antwort B'] },
  ] },
  sentence_building: { ...base, parts: ['Test', 'ist', 'Test'], correct_answer: 'Test ist Test.', accepted_answers: ['Test ist Test.'] },
  matching: { ...base, pairs: [{ id: 'a', left: 'Links A', right: 'Rechts A' }, { id: 'b', left: 'Links B', right: 'Rechts B' }] },
  categorize: { ...base, categories: [{ id: 'a', label: 'Kategorie A' }, { id: 'b', label: 'Kategorie B' }], items: [{ id: 'x', text: 'Testkarte', category_id: 'a' }] },
  dialogue: { ...base, turns: [
    { id: 'a', speaker: 'Person A', prompt: 'Testfrage A?', type: 'multiple_choice', options: ['Antwort A', 'Antwort B'], correct_answer: 'Antwort A' },
    { id: 'b', speaker: 'Person B', prompt: 'Testfrage B?', type: 'fill_in_blank', accepted_answers: ['Testantwort'], needs_article: false },
  ] },
  listening: { ...base, transcript: 'Testantwort.', audio: { normal: '/storage/v1/object/public/path-audio/test.wav', slow: '/storage/v1/object/public/path-audio/test-slow.wav' }, exercise: { type: 'fill_in_blank', content: gap } },
  transform: { ...base, source: 'Testaussage.', accepted_answers: ['Testfrage?'], needs_article: false },
} satisfies Record<typeof LEARNING_PATH_EXERCISE_TYPES[number], unknown>

const invalidContent = {
  multiple_choice: { ...choice, correct_answer: 'Unbekannt', accepted_answers: ['Unbekannt'] },
  fill_in_blank: { ...gap, accepted_answers: [] },
  multi_blank: { ...validContent.multi_blank, blanks: [{ id: 'a', accepted_answers: ['Antwort'] }, { id: 'a', accepted_answers: ['Andere Antwort'] }] },
  sentence_building: { ...validContent.sentence_building, parts: [] },
  matching: { ...validContent.matching, pairs: [{ id: 'a', left: 'A', right: 'X' }, { id: 'b', left: 'B', right: ' x ' }] },
  categorize: { ...validContent.categorize, items: [{ id: 'x', text: 'Test', category_id: 'missing' }] },
  dialogue: { ...validContent.dialogue, turns: [{ id: 'a', speaker: 'Person', prompt: 'Test?', type: 'multiple_choice', options: ['A', 'B'], correct_answer: 'C' }] },
  listening: { ...validContent.listening, exercise: { type: 'transform', content: validContent.transform } },
  transform: { ...validContent.transform, accepted_answers: ['  '] },
}

describe('learning path authoring contracts', () => {
  it.each(LEARNING_PATH_EXERCISE_TYPES)('validates %s without changing authored content', exercise_type => {
    const exercise = { exercise_type, content: validContent[exercise_type] }
    expect(learningPathExerciseSchema.parse(exercise)).toEqual(exercise)
  })

  it.each(LEARNING_PATH_EXERCISE_TYPES)('rejects malformed %s content', exercise_type => {
    expect(learningPathContentSchemas[exercise_type].safeParse(invalidContent[exercise_type]).success).toBe(false)
  })

  it.each(LEARNING_PATH_EXERCISE_TYPES)('requires target form and rejects unrecognized fields for %s', exercise_type => {
    const { target_form: _target, ...content } = validContent[exercise_type]
    expect(learningPathContentSchemas[exercise_type].safeParse(content).success).toBe(false)
    expect(learningPathContentSchemas[exercise_type].safeParse({ ...validContent[exercise_type], leaked_solution: 'Test' }).success).toBe(false)
  })

  it('rejects ambiguous options, empty contexts and mismatched canonical answers', () => {
    expect(learningPathContentSchemas.multiple_choice.safeParse({ ...choice, options: ['Option A', ' option   a '] }).success).toBe(false)
    expect(learningPathContentSchemas.multiple_choice.safeParse({ ...choice, accepted_answers: ['Option A', 'Option B'] }).success).toBe(false)
    expect(learningPathContentSchemas.fill_in_blank.safeParse({ ...gap, text_before: '', text_after: '  ' }).success).toBe(false)
    expect(learningPathContentSchemas.fill_in_blank.safeParse({ ...gap, accepted_answers: ['Andere Antwort'] }).success).toBe(false)
    expect(learningPathContentSchemas.sentence_building.safeParse({ ...validContent.sentence_building, accepted_answers: ['Andere Antwort'] }).success).toBe(false)
  })

  it('protects German task fields while keeping translations separate', () => {
    expect(learningPathContentSchemas.transform.safeParse({ ...validContent.transform, source: 'Перевод' }).success).toBe(false)
    expect(learningPathContentSchemas.multi_blank.safeParse({ ...validContent.multi_blank, blanks: [{ id: 'a', label: 'Yanıt', accepted_answers: ['Test'] }] }).success).toBe(false)
  })

  it.each(['https://external.example/audio.wav', '//external.example/audio.wav', '/audio/../test.wav', '/audio/%2e%2e/test.wav', '/audio\\test.wav', '/audio/test wav', 'storage/test.wav'])(
    'rejects nonlocal or traversing audio reference %s', reference => {
      expect(learningPathAudioReferenceSchema.safeParse(reference).success).toBe(false)
    },
  )
})

const seedFile = readFileSync(join(__dirname, '../supabase/seeds/path-a1.1.json'))
const seed = JSON.parse(seedFile.toString('utf8'))
const copy = () => JSON.parse(JSON.stringify(seed))

describe('existing Phase 4 seed compatibility (read-only)', () => {
  it.each(['00000000-0000-0000-0000-000000000000', 'ffffffff-ffff-ffff-ffff-ffffffffffff'])('rejects UUID sentinel %s consistently with SQL', id => {
    const changed = copy()
    changed[0].nodes[0].exercises[0].id = id
    expect(learningPathSeedSchema.safeParse(changed).success).toBe(false)
  })
  it('validates every source record and preserves the existing file exactly', () => {
    expect(createHash('sha256').update(seedFile).digest('hex')).toBe('d5d954b7579ababef29876eb5321757d722194bd096ae44bf1ab925864c99a0c')
    const parsed = learningPathSeedSchema.parse(seed)
    expect(parsed).toEqual(seed)
    expect(parsed).toHaveLength(7)
    const nodes = parsed.flatMap(path => path.nodes)
    expect(nodes).toHaveLength(85)
    expect(nodes.flatMap(node => node.exercises)).toHaveLength(769)
    expect(parsed.flatMap(path => path.objectives)).toHaveLength(87)
  })

  it('requires all four translations alongside the German original', () => {
    const invalid = copy()
    delete invalid[0].nodes[0].merkkarte.translations.uk
    delete invalid[0].nodes[0].exercises[0].translations.tr
    const result = learningPathSeedSchema.safeParse(invalid)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.map(issue => issue.path.join('.'))).toEqual(expect.arrayContaining([
      '0.nodes.0.merkkarte.translations.uk', '0.nodes.0.exercises.0.translations.tr',
    ]))
  })

  it('requires source identity uniqueness, valid node goals and exact mirrored answers', () => {
    const invalid = copy()
    invalid[0].nodes[0].exercises[0].id = invalid[1].nodes[0].exercises[0].id
    invalid[0].nodes[0].exercises[0].goal = 'missing'
    invalid[0].nodes[0].exercises[0].accepted_answers = ['Abweichende Antwort']
    expect(learningPathSeedSchema.safeParse(invalid).success).toBe(false)
  })

  it('requires a double-size pool and room for every objective in each draw', () => {
    const smallPool = copy()
    smallPool[0].nodes.at(-1).test_size = 18
    expect(learningPathSeedSchema.safeParse(smallPool).success).toBe(false)
    const smallTest = copy()
    smallTest[0].nodes.at(-1).test_size = 15
    expect(learningPathSeedSchema.safeParse(smallTest).success).toBe(false)
  })

  it('rejects a pool that omits an objective even if it is large enough', () => {
    const invalid = copy()
    const test = invalid[0].nodes.at(-1)
    const missingGoal = test.exercises[0].goal
    const otherGoal = test.exercises.find((exercise: { goal: string }) => exercise.goal !== missingGoal).goal
    test.goals = test.goals.filter((goal: string) => goal !== missingGoal)
    for (const exercise of test.exercises) if (exercise.goal === missingGoal) exercise.goal = otherGoal
    expect(learningPathSeedSchema.safeParse(invalid).success).toBe(false)
  })

  it('supports a structural special-branch fixture without changing the curriculum', () => {
    const fixture = copy()
    const special = JSON.parse(JSON.stringify(fixture[0].nodes[0]))
    special.id = 'fixture-special'
    special.kind = 'special'
    special.sort_order = fixture[0].nodes.length + 1
    special.anchor_node_id = fixture[0].nodes[0].id
    special.exercises.forEach((exercise: { id: string; ref: string }, index: number) => {
      exercise.id = `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`
      exercise.ref = `fixture-special-${index}`
    })
    fixture[0].nodes.push(special)
    expect(learningPathSeedSchema.safeParse(fixture).success).toBe(true)
    special.anchor_node_id = 'missing'
    expect(learningPathSeedSchema.safeParse(fixture).success).toBe(false)
  })
})
