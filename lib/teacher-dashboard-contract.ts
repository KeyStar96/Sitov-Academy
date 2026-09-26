import { z } from 'zod'
import { ACCESS_LEVELS, TRAINERS } from '@/lib/access/levels'
import type { PhaseDistribution } from '@/lib/vocabulary-ui'

export const TEACHER_TABS = ['overview', 'vocabulary', 'path', 'pronunciation', 'activity', 'notes'] as const
export const teacherTabSchema = z.enum(TEACHER_TABS)
export type TeacherTab = z.infer<typeof teacherTabSchema>
const count = z.number().int().nonnegative()
const id = z.string().uuid()
const date = z.string()
const nullableText = z.string().nullable()
export const teacherPhasesSchema = z.object({ '1': count, '2': count, '3': count, '4': count, '5': count, '6': count, learned: count })
export type TeacherPhases = z.infer<typeof teacherPhasesSchema>
export const teacherStudentSchema = z.object({
  id, role: z.enum(['student', 'teacher', 'admin']).nullable(), created_at: date.nullable(),
  person: z.object({ display_name: nullableText, email: nullableText, phone: nullableText,
    street: nullableText, postal_code: nullableText, city: nullableText }).transform(person => ({ display_name: person.display_name ?? '', email: person.email ?? '', phone: person.phone ?? null, street: person.street ?? null, postal_code: person.postal_code ?? null, city: person.city ?? null })).nullable(),
  allowed_levels: z.array(z.enum(ACCESS_LEVELS)),
  trainer_grants: z.array(z.object({ level: z.string(), trainer: z.enum(TRAINERS), enabled: z.boolean(), unit_ids: z.array(z.string()).nullable() })),
  lastActiveAt: date.nullable(), learningSeconds7d: count, learningSeconds30d: count, streakDays: count,
  currentLevel: nullableText,
  pathPosition: z.object({ unitId: id, title: z.string(), completedNodes: count, totalNodes: count }).nullable(),
  lastTest: z.object({ percentage: z.number().min(0).max(100).nullable(), passed: z.boolean().nullable(), completedAt: date.nullable() }).nullable(),
  dueCards: count, phases: teacherPhasesSchema, attentionReasons: z.array(z.string()),
  completedPathsByLevel: z.array(z.object({ level: z.string(), completed: count, total: count })),
}).transform(row => ({ ...row, person: row.person ?? null, role: row.role ?? null, created_at: row.created_at ?? null }))
export type TeacherStudent = z.infer<typeof teacherStudentSchema>
const distribution = { level: z.string(), phases: teacherPhasesSchema, totalCards: count, totalInBox: count }
export const teacherVocabularySchema = z.object({
  byLevel: z.array(z.object(distribution)),
  byLesson: z.array(z.object({ ...distribution, id, title: z.string(), paused: z.boolean() })),
  halfKnown: z.array(z.object({ id, word: z.string(), level: z.string(), boxes: z.array(count) })),
  hardest: z.array(z.object({ id, word: z.string(), level: z.string(), regressions: count })),
  recentAnswers: z.array(z.object({ id: z.string(), word: z.string(), level: z.string(), typedAnswer: nullableText, correct: z.boolean(), createdAt: date })),
  pausedLessons: z.array(z.object({ id, level: z.string(), title: z.string() })),
  carryover: z.array(z.object({ level: z.string(), enabled: z.boolean(), count })), ownWordCount: count,
})
export const teacherPathSchema = z.object({
  paths: z.array(z.object({ id, level: z.string(), title: z.string(), available: z.boolean(), completed: z.boolean(),
    nodes: z.array(z.object({ id, kind: z.enum(['practice', 'review', 'test', 'special']), title: z.string(), available: z.boolean(),
      status: nullableText, stars: count.max(3), sort_order: z.number() })) })),
  attempts: z.array(z.object({ id, nodeId: id, unitId: id, title: z.string(), status: z.string(), isActive: z.boolean(),
    percentage: z.number().nullable(), passed: z.boolean().nullable(), createdAt: date, completedAt: date.nullable(),
    answers: z.array(z.object({ exerciseId: id, position: z.number(), prompt: z.unknown(), answer: z.unknown(), result: z.unknown(), solution: z.unknown() })) })),
  interventions: z.array(z.object({ id, unitId: id, nodeId: id.nullable(), action: z.enum(['unlock', 'reset_path', 'reset_test']), createdAt: date, createdBy: z.string() })),
})
export const teacherPronunciationSchema = z.object({ conversations: z.array(z.object({ id, createdAt: date, status: z.string(), messageCount: count, unansweredCount: count, lastMessageAt: date.nullable() })) })
export const teacherActivitySchema = z.object({ days: z.array(z.object({ date, seconds: count, answers: count, active: z.boolean() })),
  byMode: z.array(z.object({ mode: z.string(), seconds: count })), totalSeconds: count })
export const teacherNotesSchema = z.object({ notes: z.array(z.object({ id, note_text: z.string(), created_at: date, updated_at: date, teacher_id: id })) })
export const teacherDetailSchemas = { overview: teacherStudentSchema, vocabulary: teacherVocabularySchema,
  path: teacherPathSchema, pronunciation: teacherPronunciationSchema, activity: teacherActivitySchema, notes: teacherNotesSchema }
export type TeacherDetailData = { [K in TeacherTab]: z.infer<(typeof teacherDetailSchemas)[K]> }
export type TeacherResult<T> = { data: T; error?: never } | { error: string; data?: never }
export const teacherInterventionSchema = z.object({ studentId: id, unitId: id,
  action: z.enum(['unlock', 'reset_path', 'reset_test']), nodeId: id.nullable(), requestId: id }).strict()
  .refine(value => value.action === 'reset_test' ? value.nodeId !== null : value.nodeId === null)
export type TeacherIntervention = z.infer<typeof teacherInterventionSchema>

/** Aggregate bars only; never manufacture card objects proportional to bucket sizes. */
export function teacherDistribution(phases: TeacherPhases, totalCards?: number): PhaseDistribution {
  const buckets = ([1, 2, 3, 4, 5, 6, 'learned'] as const).map(key => ({ key, count: phases[key] }))
  const totalInBox = buckets.reduce((sum, item) => sum + item.count, 0)
  const total = totalCards ?? totalInBox
  return { buckets, totalInBox, totalCards: total, overallPercent: total ? Math.round(buckets.reduce((sum, item) => sum + item.count * (item.key === 'learned' ? 7 : item.key), 0) / (total * 7) * 100) : 0 }
}
