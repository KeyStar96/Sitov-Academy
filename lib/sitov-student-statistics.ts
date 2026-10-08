import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/supabase/database.types'
import { readAllRows } from '@/lib/supabase-read'

/** All three dashboard counts describe the same student population. A profile
 * counts once, whether it has one or several level grants. Staff access never
 * contributes to student statistics; an empty grant list means unassigned. */
export async function loadSitovStudentStatistics(client: SupabaseClient<Database>) {
  const students = await readAllRows<{ id: string; level_access: { auth_user_id: string }[] }>((from, to) =>
    client.from('profiles').select('id,level_access:student_level_access(auth_user_id)')
      .eq('role', 'student').order('id').range(from, to))
  const activatedCount = students.filter(student => student.level_access.length > 0).length
  return {
    studentCount: students.length,
    activatedCount,
    newStudentCount: students.length - activatedCount,
  }
}
