import { z } from 'zod'
import { ACCESS_LEVELS } from './access/levels'

/** Authoring/import contracts only. PostgreSQL alone grades submitted answers. */
export const LEARNING_PATH_EXERCISE_TYPES = [
  'multiple_choice', 'fill_in_blank', 'multi_blank', 'sentence_building',
  'matching', 'categorize', 'dialogue', 'listening', 'transform',
] as const
export const LEARNING_PATH_NODE_KINDS = ['practice', 'review', 'test', 'special'] as const
export const LEARNING_PATH_OBJECTIVE_AREAS = ['grammar', 'communication', 'can_do', 'vocabulary'] as const
export const LEARNING_PATH_TRANSLATION_LOCALES = ['en', 'ru', 'uk', 'tr'] as const

// Matches the existing German-field protection; translated copy belongs outside content.
const NOT_GERMAN = /[Ѐ-ԯᲀ-᲏ᴫᵸⷠ-ⷿꙀ-ꚟ\u{1E030}-\u{1E08F}ığşİĞŞ]/u
const codepointLimit = (limit: number) => (value: string) => [...value].length <= limit
const safeString = z.string().refine(value => !/[\u0000\uFEFF]/.test(value), 'Text must not contain NUL or BOM characters')
const text = safeString.refine(codepointLimit(4000), 'Text is too long').refine(value => value.trim().length > 0, 'Text must not be blank')
const germanText = text.refine(value => !NOT_GERMAN.test(value.normalize('NFC')), 'Use the translation fields for non-German text')
const sentencePart = safeString.refine(codepointLimit(4000), 'Text is too long').refine(value => !NOT_GERMAN.test(value.normalize('NFC')), 'Use German sentence text')
const sourceId = safeString.refine(codepointLimit(100), 'Source ID is too long').refine(value => value.trim().length > 0, 'Source ID must not be blank')
const positiveInteger = z.number().int().positive().max(2147483647)
const normalized = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()
const distinct = (values: readonly string[]) => new Set(values.map(normalized)).size === values.length
const answerList = z.array(germanText).min(1).max(128).refine(distinct, 'Answers must be distinct')
// The existing accepted-answer CHECK remains in force for these three types.
const legacyAnswerList = z.array(germanText.refine(codepointLimit(1000), 'Answer is too long')).min(1).max(21).refine(distinct, 'Answers must be distinct')
const options = z.array(germanText).min(2).max(128).refine(distinct, 'Options must be distinct')
const baseContent = { target_form: z.array(germanText).min(1).max(128), instruction: germanText.optional() }
const writtenAnswer = { accepted_answers: answerList, needs_article: z.boolean().optional() }

function canonicalAnswer(value: { correct_answer: string; accepted_answers: string[] }, ctx: z.RefinementCtx) {
  if (!value.accepted_answers.some(answer => normalized(answer) === normalized(value.correct_answer))) {
    ctx.addIssue({ code: 'custom', path: ['accepted_answers'], message: 'Accepted answers must include the correct answer' })
  }
}

function choiceAnswer(value: { correct_answer: string; options: string[] }, ctx: z.RefinementCtx) {
  if (!value.options.some(option => normalized(option) === normalized(value.correct_answer))) {
    ctx.addIssue({ code: 'custom', path: ['correct_answer'], message: 'Correct answer must be an option' })
  }
}

function uniqueIds(value: readonly { id: string }[], ctx: z.RefinementCtx, path: string[]) {
  if (new Set(value.map(item => item.id)).size !== value.length) {
    ctx.addIssue({ code: 'custom', path, message: 'IDs must be unique' })
  }
}

export const multipleChoiceContentSchema = z.strictObject({
  ...baseContent, question: germanText, options, correct_answer: germanText,
  accepted_answers: legacyAnswerList.refine(value => value.length === 1, 'A choice has one accepted answer'),
}).superRefine((value, ctx) => { choiceAnswer(value, ctx); canonicalAnswer(value, ctx) })

export const fillInBlankContentSchema = z.strictObject({
  ...baseContent, ...writtenAnswer, accepted_answers: legacyAnswerList, text_before: sentencePart, text_after: sentencePart,
  correct_answer: germanText, options: options.optional(),
}).superRefine((value, ctx) => {
  canonicalAnswer(value, ctx)
  if (!`${value.text_before}${value.text_after}`.trim()) {
    ctx.addIssue({ code: 'custom', path: ['text_before'], message: 'A gap needs sentence context' })
  }
  if (value.options) choiceAnswer({ correct_answer: value.correct_answer, options: value.options }, ctx)
})

export const sentenceBuildingContentSchema = z.strictObject({
  ...baseContent, parts: z.array(germanText).min(1).max(128),
  correct_answer: germanText, accepted_answers: legacyAnswerList,
}).superRefine(canonicalAnswer)

export const multiBlankContentSchema = z.strictObject({
  ...baseContent, text: germanText,
  blanks: z.array(z.strictObject({ id: sourceId, label: germanText.optional(), ...writtenAnswer })).min(1).max(128),
}).superRefine((value, ctx) => uniqueIds(value.blanks, ctx, ['blanks']))

export const matchingContentSchema = z.strictObject({
  ...baseContent,
  pairs: z.array(z.strictObject({ id: sourceId, left: germanText, right: germanText })).min(1).max(128),
}).superRefine((value, ctx) => {
  uniqueIds(value.pairs, ctx, ['pairs'])
  if (!distinct(value.pairs.map(pair => pair.left)) || !distinct(value.pairs.map(pair => pair.right))) {
    ctx.addIssue({ code: 'custom', path: ['pairs'], message: 'Both sides of matching pairs must be distinct' })
  }
})

export const categorizeContentSchema = z.strictObject({
  ...baseContent,
  categories: z.array(z.strictObject({ id: sourceId, label: germanText })).min(2).max(128),
  items: z.array(z.strictObject({ id: sourceId, text: germanText, category_id: sourceId })).min(1).max(128),
}).superRefine((value, ctx) => {
  uniqueIds(value.categories, ctx, ['categories']); uniqueIds(value.items, ctx, ['items'])
  const categoryIds = new Set(value.categories.map(category => category.id))
  value.items.forEach((item, index) => {
    if (!categoryIds.has(item.category_id)) {
      ctx.addIssue({ code: 'custom', path: ['items', index, 'category_id'], message: 'Unknown category' })
    }
  })
})

const dialogueTurn = { id: sourceId, speaker: germanText, prompt: germanText }
export const dialogueContentSchema = z.strictObject({
  ...baseContent,
  turns: z.array(z.discriminatedUnion('type', [
    z.strictObject({ ...dialogueTurn, type: z.literal('multiple_choice'), options, correct_answer: germanText }).superRefine(choiceAnswer),
    z.strictObject({ ...dialogueTurn, type: z.literal('fill_in_blank'), ...writtenAnswer }),
  ])).min(1).max(128),
}).superRefine((value, ctx) => uniqueIds(value.turns, ctx, ['turns']))

export const learningPathAudioReferenceSchema = text.refine(value => (
  value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
  && !value.split(/[/?#]/).includes('..') && !/%(?:2e|2f|5c)/i.test(value)
  && !/[\s\u0000-\u001f]/.test(value)
), 'Audio must use a local absolute path without traversal')

export const listeningContentSchema = z.strictObject({
  ...baseContent, transcript: germanText.refine(codepointLimit(3000), 'Transcript is too long'),
  audio: z.strictObject({ normal: learningPathAudioReferenceSchema, slow: learningPathAudioReferenceSchema }),
  exercise: z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('multiple_choice'), content: multipleChoiceContentSchema }),
    z.strictObject({ type: z.literal('fill_in_blank'), content: fillInBlankContentSchema }),
  ]),
})

export const transformContentSchema = z.strictObject({ ...baseContent, source: germanText, ...writtenAnswer })

export const learningPathContentSchemas = {
  multiple_choice: multipleChoiceContentSchema,
  fill_in_blank: fillInBlankContentSchema,
  multi_blank: multiBlankContentSchema,
  sentence_building: sentenceBuildingContentSchema,
  matching: matchingContentSchema,
  categorize: categorizeContentSchema,
  dialogue: dialogueContentSchema,
  listening: listeningContentSchema,
  transform: transformContentSchema,
} as const

export const learningPathExerciseSchema = z.discriminatedUnion('exercise_type', [
  z.strictObject({ exercise_type: z.literal('multiple_choice'), content: multipleChoiceContentSchema }),
  z.strictObject({ exercise_type: z.literal('fill_in_blank'), content: fillInBlankContentSchema }),
  z.strictObject({ exercise_type: z.literal('multi_blank'), content: multiBlankContentSchema }),
  z.strictObject({ exercise_type: z.literal('sentence_building'), content: sentenceBuildingContentSchema }),
  z.strictObject({ exercise_type: z.literal('matching'), content: matchingContentSchema }),
  z.strictObject({ exercise_type: z.literal('categorize'), content: categorizeContentSchema }),
  z.strictObject({ exercise_type: z.literal('dialogue'), content: dialogueContentSchema }),
  z.strictObject({ exercise_type: z.literal('listening'), content: listeningContentSchema }),
  z.strictObject({ exercise_type: z.literal('transform'), content: transformContentSchema }),
])

const titleTranslations = z.strictObject({
  en: z.strictObject({ title: text }), ru: z.strictObject({ title: text }),
  uk: z.strictObject({ title: text }), tr: z.strictObject({ title: text }),
})
const ruleTranslations = z.strictObject({
  en: z.strictObject({ rule: text }), ru: z.strictObject({ rule: text }),
  uk: z.strictObject({ rule: text }), tr: z.strictObject({ rule: text }),
})
const exerciseTranslation = z.strictObject({ instruction: text, hint: text, explanation: text, prompt: text.optional() })
export const learningPathExerciseTranslationsSchema = z.strictObject({
  en: exerciseTranslation, ru: exerciseTranslation, uk: exerciseTranslation, tr: exerciseTranslation,
})

export const learningPathMemoryCardSchema = z.strictObject({
  card: sourceId, rule: germanText, examples: z.array(germanText).min(1).max(128),
  highlight: z.enum(['article', 'verb']).nullable(), translations: ruleTranslations,
})

// accepted_answers at exercise level is a compatibility mirror in the existing seed.
// New structured exercise types keep their solutions only in the typed content fields.
export const learningPathSeedExerciseSchema = z.strictObject({
  // Match the SQL import contract: versioned RFC UUIDs, not nil/max sentinels.
  id: z.uuid().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i), ref: sourceId, goal: sourceId,
  exercise_type: z.enum(LEARNING_PATH_EXERCISE_TYPES), content: z.unknown(),
  accepted_answers: answerList.optional(), hint: germanText, explanation: germanText,
  explanation_card: sourceId, translations: learningPathExerciseTranslationsSchema,
}).superRefine((value, ctx) => {
  const result = learningPathContentSchemas[value.exercise_type].safeParse(value.content)
  if (!result.success) {
    for (const issue of result.error.issues) ctx.addIssue({ ...issue, path: ['content', ...issue.path] })
    return
  }
  if (value.accepted_answers) {
    const accepted = 'accepted_answers' in result.data ? result.data.accepted_answers : undefined
    if (JSON.stringify(value.accepted_answers) !== JSON.stringify(accepted)) {
      ctx.addIssue({ code: 'custom', path: ['accepted_answers'], message: 'Mirrored answers must exactly match content.accepted_answers' })
    }
  }
})

export const learningPathSeedNodeSchema = z.strictObject({
  id: sourceId, kind: z.enum(LEARNING_PATH_NODE_KINDS), sort_order: positiveInteger,
  is_active: z.boolean().optional(),
  topic: germanText, title: germanText, translations: titleTranslations,
  goals: z.array(sourceId).min(1).max(128), merkkarte: learningPathMemoryCardSchema.optional(),
  test_size: positiveInteger.max(128).optional(), anchor_node_id: sourceId.optional(),
  exercises: z.array(learningPathSeedExerciseSchema).min(1),
}).superRefine((value, ctx) => {
  if (new Set(value.goals).size !== value.goals.length) {
    ctx.addIssue({ code: 'custom', path: ['goals'], message: 'Node goals must be unique' })
  }
  if (value.kind === 'practice' && !value.merkkarte) {
    ctx.addIssue({ code: 'custom', path: ['merkkarte'], message: 'Practice nodes need a memory card' })
  }
  if (value.kind === 'test') {
    if (!value.test_size) ctx.addIssue({ code: 'custom', path: ['test_size'], message: 'Test size is required' })
    if (value.merkkarte) ctx.addIssue({ code: 'custom', path: ['merkkarte'], message: 'Tests have no memory cards' })
    if (value.test_size && value.exercises.length < 2 * value.test_size) {
      ctx.addIssue({ code: 'custom', path: ['exercises'], message: 'The pool must contain at least twice the test size' })
    }
  } else if (value.test_size !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['test_size'], message: 'Only test nodes have a test size' })
  }
  if ((value.kind === 'special') !== (value.anchor_node_id !== undefined)) {
    ctx.addIssue({ code: 'custom', path: ['anchor_node_id'], message: 'Only special nodes require an anchor' })
  }
  value.exercises.forEach((exercise, index) => {
    if (!value.goals.includes(exercise.goal)) {
      ctx.addIssue({ code: 'custom', path: ['exercises', index, 'goal'], message: 'Exercise goal must belong to its node' })
    }
  })
  for (const goal of value.goals) {
    if (!value.exercises.some(exercise => exercise.goal === goal)) {
      ctx.addIssue({ code: 'custom', path: ['goals'], message: 'Every node goal needs an exercise' })
    }
  }
})

export const learningPathSeedPathSchema = z.strictObject({
  id: sourceId, level: z.enum(ACCESS_LEVELS), path: positiveInteger,
  is_active: z.boolean().optional(),
  slug: z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: germanText, translations: titleTranslations,
  unit: z.strictObject({ level: z.enum(ACCESS_LEVELS), trainer: z.literal('exercises'), label: germanText, sort_order: positiveInteger }),
  objectives: z.array(z.strictObject({ id: sourceId, area: z.enum(LEARNING_PATH_OBJECTIVE_AREAS), description: germanText })).min(1).max(128),
  nodes: z.array(learningPathSeedNodeSchema).min(3),
}).superRefine((value, ctx) => {
  if (value.level !== value.unit.level || value.path !== value.unit.sort_order) {
    ctx.addIssue({ code: 'custom', path: ['unit'], message: 'Unit level and order must match its path' })
  }
  uniqueIds(value.objectives, ctx, ['objectives']); uniqueIds(value.nodes, ctx, ['nodes'])
  const objectiveIds = new Set(value.objectives.map(objective => objective.id))
  const mainNodes = value.nodes.filter(node => node.kind !== 'special' && node.is_active !== false).sort((a, b) => a.sort_order - b.sort_order)
  if (new Set(value.nodes.map(node => node.sort_order)).size !== value.nodes.length) {
    ctx.addIssue({ code: 'custom', path: ['nodes'], message: 'Node positions must be unique' })
  }
  if (mainNodes.length < 3 || mainNodes.at(-1)?.kind !== 'test' || mainNodes.at(-2)?.kind !== 'review'
    || mainNodes.slice(0, -2).some(node => node.kind !== 'practice')) {
    ctx.addIssue({ code: 'custom', path: ['nodes'], message: 'A path needs practice nodes, one review, then one test' })
  }
  value.nodes.forEach((node, index) => {
    if (node.goals.some(goal => !objectiveIds.has(goal))) {
      ctx.addIssue({ code: 'custom', path: ['nodes', index, 'goals'], message: 'Unknown path objective' })
    }
    if (node.kind === 'special' && !mainNodes.some(anchor => anchor.id === node.anchor_node_id && anchor.kind !== 'test')) {
      ctx.addIssue({ code: 'custom', path: ['nodes', index, 'anchor_node_id'], message: 'Special branches need a practice or review anchor in this path' })
    }
    if (node.kind === 'test') {
      if (node.test_size && node.test_size < objectiveIds.size) {
        ctx.addIssue({ code: 'custom', path: ['nodes', index, 'test_size'], message: 'Test size must cover every objective' })
      }
      const covered = new Set(node.exercises.map(exercise => exercise.goal))
      if ([...objectiveIds].some(goal => !covered.has(goal))) {
        ctx.addIssue({ code: 'custom', path: ['nodes', index, 'exercises'], message: 'The test pool must cover every path objective' })
      }
    }
  })
  const exercises = value.nodes.flatMap(node => node.exercises)
  uniqueIds(exercises, ctx, ['nodes'])
  if (new Set(exercises.map(exercise => exercise.ref)).size !== exercises.length) {
    ctx.addIssue({ code: 'custom', path: ['nodes'], message: 'Exercise source references must be unique within a path' })
  }
})

export const learningPathSeedSchema = z.array(learningPathSeedPathSchema).min(1).superRefine((paths, ctx) => {
  for (const field of ['id', 'path', 'slug'] as const) {
    const identities = paths.map(path => `${path.level}:${path[field]}`)
    if (new Set(identities).size !== identities.length) {
      ctx.addIssue({ code: 'custom', message: `Path ${field} must be unique per level` })
    }
  }
  uniqueIds(paths.flatMap(path => path.nodes.flatMap(node => node.exercises)), ctx, [])
})

export type LearningPathExerciseType = typeof LEARNING_PATH_EXERCISE_TYPES[number]
export type LearningPathExercise = z.infer<typeof learningPathExerciseSchema>
export type LearningPathSeedPath = z.infer<typeof learningPathSeedPathSchema>
export type LearningPathSeed = z.infer<typeof learningPathSeedSchema>
