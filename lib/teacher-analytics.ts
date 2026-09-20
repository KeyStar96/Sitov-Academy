import { z } from 'zod'
import type { PhaseBucket } from './vocabulary-ui'

const count = z.number().int().nonnegative()
const bucket = z.object({
  key: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal('learned')]), count,
}).transform((value): PhaseBucket => ({ key: value.key, count: value.count }))
export const teacherAnalyticsSchema = z.object({
  studentId: z.string().uuid(), courseId: z.string().uuid().nullable(), level: z.string().nullable(),
  completionByLevel: z.record(z.string(), z.number().int().min(0).max(100)),
  distribution: z.object({
    buckets: z.array(bucket).length(7),
    totalCards: count, totalInBox: count, overallPercent: z.number().int().min(0).max(100),
  }),
  history: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), answers: count, correct: count })).length(30),
  timezone: z.literal('Europe/Berlin'),
}).superRefine((data, ctx) => {
  const { distribution } = data
  if (new Set(distribution.buckets.map(bucket => bucket.key)).size !== 7 ||
    distribution.buckets.reduce((total, bucket) => total + bucket.count, 0) !== distribution.totalInBox ||
    distribution.totalInBox > distribution.totalCards || data.history.some(day => day.correct > day.answers) ||
    data.history.some((day, index) => index > 0 && day.date <= data.history[index - 1].date)) {
    ctx.addIssue({ code: 'custom', message: 'Inconsistent analytics response' })
  }
})
export type TeacherAnalytics = z.infer<typeof teacherAnalyticsSchema>
export interface AnalyticsOptions {
  students: { id: string; name: string }[]
  courses: { id: string; title: string; level: string | null }[]
}
