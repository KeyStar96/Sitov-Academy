'use server'

import { withBackendSession } from '@/lib/actions/backend'
import { readAllRows } from '@/lib/supabase-read'
import type { AnalyticsOptions } from '@/lib/teacher-analytics'
import type { BackendActionResult } from '@/lib/types/backend'

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
