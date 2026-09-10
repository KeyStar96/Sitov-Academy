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
