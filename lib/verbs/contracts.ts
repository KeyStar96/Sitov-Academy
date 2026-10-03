import type { SitovVerbEntry, SitovVerbExercise, SitovVerbLevel, SitovVerbProgress, SitovVerbTense } from './types'

export type SitovVerbResult<T> = { data: T; error?: never } | { data?: never; error: string }
export interface SitovVerbTrainerState {
  learnerId: string
  level: SitovVerbLevel
  authorizedLevels: SitovVerbLevel[]
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
