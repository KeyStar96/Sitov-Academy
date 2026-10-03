import { z } from 'zod'
import { ACCESS_LEVELS } from '@/lib/access/levels'

export const sitovCheckpointKind = z.enum(['vocabulary', 'vocabulary_focus', 'exercises', 'pronunciation', 'videos'])
export type LearningCheckpointKind = z.infer<typeof sitovCheckpointKind>
export const sitovCheckpointTarget = z.object({ kind: sitovCheckpointKind, level: z.enum(ACCESS_LEVELS) })
export const sitovCheckpointSchema = z.object({
  state: z.record(z.string(), z.unknown()), revision: z.number().int().positive(), updatedAt: z.string(),
})
export type LearningCheckpoint = z.infer<typeof sitovCheckpointSchema>
export type LearningCheckpointResult =
  | { ok: true; checkpoint: LearningCheckpoint | null; learnerId: string }
  | { ok: false; error: 'unauthorized' | 'unavailable' | 'invalid' | 'conflict'; checkpoint?: LearningCheckpoint | null }

export const sitovVideoProgressSchema = z.record(z.string().uuid(), z.object({
  t: z.number().finite().nonnegative(), d: z.number().finite().positive().max(86400), at: z.number().finite().nonnegative(),
}).refine(value => value.t <= value.d))
export type VideoProgress = z.infer<typeof sitovVideoProgressSchema>
