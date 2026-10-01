'use server'

import { z } from 'zod'
import { withBackendSession, checkDatabaseError, checkRpcError } from '@/lib/actions/backend'
import { learningProgressSchema, PROGRESS_RANGES, type LearningProgress, type ProgressRange } from '@/lib/learning-progress'
import { uuidSchema, type BackendActionResult } from '@/lib/types/backend'

const rangeSchema = z.number().int().refine((value): value is ProgressRange => (PROGRESS_RANGES as readonly number[]).includes(value))
const levelSchema = z.string().trim().min(1).max(30).nullable()

/** Lernanalyse einer lernenden Person für die Lehrkraft (Tageswerte je Modus, Stände, Problemwörter). */
export async function getStudentLearningProgress(input: unknown): Promise<BackendActionResult<LearningProgress>> {
  return withBackendSession(async ({ supabase }) => {
    const { studentId, level, days } = z.object({ studentId: uuidSchema, level: levelSchema, days: rangeSchema }).strict().parse(input)
    const { data, error } = await supabase.rpc('get_learning_progress', { p_student_id: studentId, p_level: level, p_days: days })
    checkDatabaseError(error)
    checkRpcError(data)
    return learningProgressSchema.parse(data)
  }, 'staff')
}

/** „Mein Fortschritt": dieselbe Auswertung, ausschließlich für die angemeldete Person. */
export async function getMyLearningProgress(input: unknown): Promise<BackendActionResult<LearningProgress>> {
  return withBackendSession(async ({ supabase }) => {
    const { level, days } = z.object({ level: levelSchema, days: rangeSchema }).strict().parse(input)
    const { data, error } = await supabase.rpc('get_learning_progress', { p_student_id: null, p_level: level, p_days: days })
    checkDatabaseError(error)
    checkRpcError(data)
    return learningProgressSchema.parse(data)
  })
}
