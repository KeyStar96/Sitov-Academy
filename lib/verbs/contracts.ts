import type { SitovVerbEntry, SitovVerbExercise, SitovVerbTrainerLevel, SitovVerbProgress, SitovVerbTense } from './types'

export type SitovVerbResult<T> = { data: T; error?: never } | { data?: never; error: string }
export interface SitovVerbTrainerState {
  learnerId: string
  level: SitovVerbTrainerLevel
  authorizedLevels: SitovVerbTrainerLevel[]
  tenses: SitovVerbTense[]
  verbs: (SitovVerbEntry & { unitId: string })[]
  selectedIds: string[]
  progress: SitovVerbProgress[]
}
export type SitovVerbPublicExercise = Omit<SitovVerbExercise, 'id' | 'answers' | 'solution'> & {
  exerciseId: string
  infinitive: string
  translation: string
}
export interface SitovVerbReviewResult { correct: boolean; solution: string; progress: SitovVerbProgress }
