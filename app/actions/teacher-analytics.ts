'use server'

import { z } from 'zod'
import { withBackendSession, checkDatabaseError, checkRpcError } from '@/lib/actions/backend'
import { readAllRows } from '@/lib/supabase-read'
import { teacherAnalyticsSchema, type AnalyticsOptions, type TeacherAnalytics } from '@/lib/teacher-analytics'
import { uuidSchema, type BackendActionResult } from '@/lib/types/backend'

export async function getTeacherAnalyticsOptions(): Promise<BackendActionResult<AnalyticsOptions>> {
  return withBackendSession(async ({ supabase }) => {
    const [students, levels] = await Promise.all([
      readAllRows((from, to) => supabase.from('profiles').select('id,person:people(display_name)')
        .eq('role', 'student').order('id').range(from, to)),
      readAllRows((from, to) => supabase.from('learning_levels').select('code')
        .order('sort_order').order('code').range(from, to)),
    ])
    return { students: students.map(student => ({ id: student.id, name: student.person?.display_name ?? '' })), levels }
  }, 'staff')
}

export async function getTeacherAnalytics(input: unknown): Promise<BackendActionResult<TeacherAnalytics>> {
  return withBackendSession(async ({ supabase }) => {
    const { studentId, level } = z.object({ studentId: uuidSchema, level: z.string().trim().min(1).max(30).nullable() }).strict().parse(input)
    const { data, error } = await supabase.rpc('get_student_learning_analytics', { p_student_id: studentId, p_level: level })
    checkDatabaseError(error)
    checkRpcError(data)
    return teacherAnalyticsSchema.parse(data)
  }, 'staff')
}
