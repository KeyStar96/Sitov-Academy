import type { StudentExercise } from '@/lib/types/exercise'

export interface GrammarTopic {
  name: string
  total: number
  completed: number
}
export interface GrammarSessionOptions {
  topic?: string
  review?: boolean
  limit?: number
}
export interface GrammarCheckpoint {
  exerciseIds: string[]
  currentIndex: number
}

/** Account checkpoints can only reopen exercises still available to this learner. */
export function restoreGrammarCheckpoint(exercises: readonly StudentExercise[], state?: Record<string, unknown> | null): {
  exercises: StudentExercise[]; currentIndex: number
} | null {
  if (!state || !Array.isArray(state.exerciseIds) || state.exerciseIds.length === 0 || state.exerciseIds.length > 10
    || !state.exerciseIds.every(id => typeof id === 'string') || new Set(state.exerciseIds).size !== state.exerciseIds.length
    || !Number.isInteger(state.currentIndex) || Number(state.currentIndex) < 0 || Number(state.currentIndex) >= state.exerciseIds.length) return null
  const byId = new Map(exercises.map(exercise => [exercise.id, exercise]))
  const restored = state.exerciseIds.map(id => byId.get(id))
  if (restored.some(exercise => !exercise)) return null
  return { exercises: restored as StudentExercise[], currentIndex: Number(state.currentIndex) }
}

export function grammarCheckpoint(exercises: readonly StudentExercise[], currentIndex: number): Record<string, unknown> {
  return { exerciseIds: exercises.map(exercise => exercise.id), currentIndex }
}
export function groupGrammarTopics(exercises: readonly StudentExercise[]): GrammarTopic[] {
  const topics = new Map<string, GrammarTopic>()
  for (const exercise of exercises) {
    const topic = topics.get(exercise.topic) ?? { name: exercise.topic, total: 0, completed: 0 }
    topic.total += 1
    if (exercise.completed) topic.completed += 1
    topics.set(exercise.topic, topic)
  }
  return [...topics.values()]
}
export function createGrammarSession(exercises: readonly StudentExercise[], options: GrammarSessionOptions = {}): StudentExercise[] {
  const limit = Math.min(10, Math.max(1, options.limit ?? 10))
  return exercises.filter(exercise => (!options.topic || exercise.topic === options.topic) && (options.review || !exercise.completed)).slice(0, limit)
}
