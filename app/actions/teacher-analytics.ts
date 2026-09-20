'use server'

import { z } from 'zod'
import { withBackendSession, checkDatabaseError, checkRpcError } from '@/lib/actions/backend'
import { readAllRows } from '@/lib/supabase-read'
import { teacherAnalyticsSchema, type AnalyticsOptions, type TeacherAnalytics } from '@/lib/teacher-analytics'
import { uuidSchema, type BackendActionResult } from '@/lib/types/backend'

export async function getTeacherAnalyticsOptions(): Promise<BackendActionResult<AnalyticsOptions>> {
  return withBackendSession(async ({ supabase }) => {
    const [students, courses] = await Promise.all([
      readAllRows((from, to) => supabase.from('profiles').select('id,person:people(display_name)')
        .eq('role', 'student').order('id').range(from, to)),
      readAllRows((from, to) => supabase.from('courses').select('id,title,level')
        .order('sort_order').order('id').range(from, to)),
    ])
    return { students: students.map(student => ({ id: student.id, name: student.person?.display_name ?? '' })), courses }
  }, 'staff')
}

export async function getTeacherAnalytics(input: unknown): Promise<BackendActionResult<TeacherAnalytics>> {
  return withBackendSession(async ({ supabase }) => {
    const { studentId, courseId } = z.object({ studentId: uuidSchema, courseId: uuidSchema.nullable() }).strict().parse(input)
    const { data, error } = await supabase.rpc('get_all_students_progress_data', { p_student_id: studentId, p_course_id: courseId })
    checkDatabaseError(error)
    checkRpcError(data)
    return teacherAnalyticsSchema.parse(data)
  }, 'staff')
}
