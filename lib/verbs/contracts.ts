import type { SitovVerbEntry, SitovVerbExercise, SitovVerbTrainerLevel, SitovVerbProgress, SitovVerbTense } from './types'
import type { SoftErrorReason } from '@/lib/answer-grading'

export type SitovVerbResult<T> = { data: T; error?: never } | { data?: never; error: string }
export interface SitovVerbTrainerState {
  learnerId: string
  level: SitovVerbTrainerLevel
  authorizedLevels: SitovVerbTrainerLevel[]
  tenses: SitovVerbTense[]
  verbs: (SitovVerbEntry & { unitId: string })[]
  selectedIds: string[]
  progress: SitovVerbProgress[]
  /** Last graded source verbs across contexts; ties wait for another verb too. */
  previousVerbIds?: string[]
}
export type SitovVerbPublicExercise = Omit<SitovVerbExercise, 'id' | 'answers' | 'solution'> & {
  exerciseId: string
  infinitive: string
  translation: string
}
export interface SitovVerbReviewResult { correct: boolean; solution: string; progress: SitovVerbProgress; retry?: boolean; softError?: SoftErrorReason | null }
