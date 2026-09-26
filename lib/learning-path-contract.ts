import { z } from 'zod'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import { LOCALES } from '@/lib/locale-routing'
import { ANSWER_STATUSES, ORTHOGRAPHY_HINTS, SOFT_ERROR_REASONS } from '@/lib/answer-grading'

export const pathLocaleSchema = z.enum(LOCALES)
export const pathLevelSchema = z.enum(ACCESS_LEVELS)
export const pathIdSchema = z.string().uuid()
const text = z.string().max(4000)
const common = { instruction: text.optional(), prompt: text.optional() }

// A second allowlist at the server/client boundary. Authoring fields (including
// accepted_answers and target_form) can never cross the pre-grading boundary.
export const pathExerciseSchema = z.discriminatedUnion('type', [
  z.object({ id: pathIdSchema, type: z.literal('fill_in_blank'), content: z.object({ ...common,
    text_before: text, text_after: text, needs_article: z.boolean().optional() }) }),
  z.object({ id: pathIdSchema, type: z.literal('multiple_choice'), content: z.object({ ...common,
    question: text, options: z.array(text).min(2).max(128) }) }),
  z.object({ id: pathIdSchema, type: z.literal('sentence_building'), content: z.object({ ...common,
    parts: z.array(text).min(1).max(128) }) }),
])
export const pathAnswerSchema = z.union([
  z.object({ text: z.string().min(1).max(4000) }).strict(),
  z.object({ index: z.number().int().min(0).max(127) }).strict(),
  z.object({ indices: z.array(z.number().int().min(0).max(127)).min(1).max(128) }).strict(),
])
export const ruleCardSchema = z.object({ rule: text, examples: z.array(text).max(128),
  highlight: z.enum(['article', 'verb']).nullable().optional() })
export const pathNodeSchema = z.object({ id: pathIdSchema, kind: z.enum(['practice', 'review', 'test', 'special']),
  title: text, sort_order: z.number(), available: z.boolean(), status: z.enum(['in_progress', 'completed']).nullable(),
  stars: z.number().int().min(0).max(3),
  tests: z.array(z.object({ id: pathIdSchema, status: z.enum(['active', 'completed', 'abandoned']),
    percentage: z.number().nullable(), passed: z.boolean().nullable() })) })
export const pathMapSchema = z.object({ level: pathLevelSchema, completed: z.boolean(),
  next_level: z.string().nullable(), next_level_available: z.boolean(),
  paths: z.array(z.object({ id: pathIdSchema, source_id: text, title: text, sort_order: z.number(),
    available: z.boolean(), completed: z.boolean(), nodes: z.array(pathNodeSchema) })) })
export const practiceRunSchema = z.object({ run_id: pathIdSchema, node_id: pathIdSchema,
  queue: z.array(pathIdSchema), total: z.number().int().positive(), exercises: z.array(pathExerciseSchema),
  merkkarte: ruleCardSchema.nullable() })
export const pathGradeSchema = z.object({ status: z.enum(ANSWER_STATUSES), correct: z.boolean(),
  fields: z.array(z.object({ id: text, status: z.enum(ANSWER_STATUSES), correct: z.boolean(),
    matched: text.nullable().optional(), reason: z.enum(SOFT_ERROR_REASONS).nullable().optional(),
    hint: z.enum(ORTHOGRAPHY_HINTS).nullable().optional() })).optional() })
  .refine(value => value.correct === (value.status !== 'INCORRECT'), 'Inconsistent grade')
  // finish_path_test deliberately accepts answers without result-dependent
  // validation while saving. Ungradable submissions become this minimal
  // INCORRECT result at completion; successful grades always include fields.
  .refine(value => value.fields !== undefined || (value.status === 'INCORRECT' && value.correct === false), 'Missing grade fields')
  .transform(value => ({ ...value, fields: value.fields ?? [] }))
const solutionSchema = z.object({ content: z.object({ correct_answer: text }), explanation: text.nullable() })
export const practiceResultSchema = z.object({ grade: pathGradeSchema, solution: solutionSchema,
  completed: z.boolean(), stars: z.number().int().min(1).max(3).nullable(),
  first_attempt_accuracy: z.number().min(0).max(100), queue: z.array(pathIdSchema) })
export const pathTestSchema = z.object({ attempt_id: pathIdSchema, node_id: pathIdSchema,
  total: z.number().int().positive(), exercises: z.array(z.intersection(pathExerciseSchema,
    z.object({ answer: pathAnswerSchema.nullable() }))) })
export const testResultSchema = z.object({ attempt_id: pathIdSchema, percentage: z.number().min(0).max(100),
  passed: z.boolean(), recommended_nodes: z.array(pathIdSchema),
  answers: z.array(z.intersection(pathExerciseSchema, z.object({ answer: pathAnswerSchema,
    result: pathGradeSchema, solution: solutionSchema }))) })

export type PathExercise = z.infer<typeof pathExerciseSchema>
export type PathAnswer = z.infer<typeof pathAnswerSchema>
export type PathMap = z.infer<typeof pathMapSchema>
export type PathNode = z.infer<typeof pathNodeSchema>
export type RuleCardData = z.infer<typeof ruleCardSchema>
export type PracticeRun = z.infer<typeof practiceRunSchema>
export type PracticeResult = z.infer<typeof practiceResultSchema>
export type PathTest = z.infer<typeof pathTestSchema>
export type TestResult = z.infer<typeof testResultSchema>
export type PathGrade = z.infer<typeof pathGradeSchema>
export type PathResult<T> = { data: T; error?: never } | { error: string; data?: never }
