'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import type { Database } from '@/supabase/database.types'
import { pathLocaleSchema, pathLevelSchema, pathIdSchema, pathAnswerSchema, pathMapSchema,
  practiceRunSchema, practiceResultSchema, pathTestSchema, testResultSchema,
  type PathResult, type PathMap, type PracticeRun, type PracticeResult, type PathTest, type TestResult } from '@/lib/learning-path-contract'

type PathRpc = 'get_learning_path' | 'start_path_node' | 'submit_path_answer'
  | 'start_path_test' | 'submit_path_test_answer' | 'finish_path_test'

/** Cookie identity only. PostgreSQL checks access, ownership, ordering and grading. */
async function callPathRpc<T, N extends PathRpc>(name: N,
  args: Database['public']['Functions'][N]['Args'], schema: z.ZodType<T>): Promise<PathResult<T>> {
  try {
    const client = await createClient()
    const { data: auth, error: authError } = await client.auth.getUser()
    if (authError || !auth.user) return { error: 'authentication_required' }
    const { data, error } = await client.rpc(name, args)
    if (error) return { error: name === 'get_learning_path' && ['PGRST202', '42883'].includes(error.code)
      ? 'backend_unavailable' : 'request_failed' }
    const failure = z.object({ error: z.string() }).safeParse(data)
    if (failure.success) return { error: failure.data.error }
    const parsed = schema.safeParse(data)
    return parsed.success ? { data: parsed.data } : { error: 'invalid_response' }
  } catch { return { error: 'request_failed' } }
}

export async function getLearningPath(level: string, locale: string): Promise<PathResult<PathMap>> {
  if (!pathLevelSchema.safeParse(level).success || !pathLocaleSchema.safeParse(locale).success)
    return { error: 'invalid_input' } as const
  return callPathRpc('get_learning_path', { p_level: level, p_locale: locale }, pathMapSchema)
}

export async function startLearningNode(nodeId: string, locale: string, restart = false): Promise<PathResult<PracticeRun>> {
  if (!pathIdSchema.safeParse(nodeId).success || !pathLocaleSchema.safeParse(locale).success || typeof restart !== 'boolean')
    return { error: 'invalid_input' } as const
  return callPathRpc('start_path_node', { p_node_id: nodeId, p_locale: locale, p_restart: restart }, practiceRunSchema)
}

export async function submitLearningAnswer(input: { runId: string; exerciseId: string; answer: unknown; requestId: string; locale: string }): Promise<PathResult<PracticeResult>> {
  const parsed = z.object({ runId: pathIdSchema, exerciseId: pathIdSchema, answer: pathAnswerSchema,
    requestId: pathIdSchema, locale: pathLocaleSchema }).safeParse(input)
  if (!parsed.success) return { error: 'invalid_input' } as const
  const { runId, exerciseId, answer, requestId, locale } = parsed.data
  return callPathRpc('submit_path_answer', { p_run_id: runId, p_exercise_id: exerciseId,
    p_answer: answer, p_request_id: requestId, p_locale: locale }, practiceResultSchema)
}

export async function startLearningTest(nodeId: string, locale: string): Promise<PathResult<PathTest>> {
  if (!pathIdSchema.safeParse(nodeId).success || !pathLocaleSchema.safeParse(locale).success)
    return { error: 'invalid_input' } as const
  return callPathRpc('start_path_test', { p_node_id: nodeId, p_locale: locale }, pathTestSchema)
}

export async function saveLearningTestAnswer(input: { attemptId: string; exerciseId: string; answer: unknown }): Promise<PathResult<{ saved: true }>> {
  const parsed = z.object({ attemptId: pathIdSchema, exerciseId: pathIdSchema, answer: pathAnswerSchema }).safeParse(input)
  if (!parsed.success) return { error: 'invalid_input' } as const
  return callPathRpc('submit_path_test_answer', { p_attempt_id: parsed.data.attemptId,
    p_exercise_id: parsed.data.exerciseId, p_answer: parsed.data.answer }, z.object({ saved: z.literal(true) }))
}

export async function finishLearningTest(attemptId: string, locale: string): Promise<PathResult<TestResult>> {
  if (!pathIdSchema.safeParse(attemptId).success || !pathLocaleSchema.safeParse(locale).success)
    return { error: 'invalid_input' } as const
  return callPathRpc('finish_path_test', { p_attempt_id: attemptId, p_locale: locale }, testResultSchema)
}
