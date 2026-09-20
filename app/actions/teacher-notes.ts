'use server'

import { checkDatabaseError, checkRpcError, revalidateBackendPages, withBackendSession } from '@/lib/actions/backend'
import { z } from 'zod'
import type { BackendActionResult } from '@/lib/types/backend'
import { saveBlackboardSchema, type TeacherStudentNote } from '@/lib/types/teacher-notes'

export async function saveBlackboardNote(input: unknown): Promise<BackendActionResult<TeacherStudentNote | null>> {
  return withBackendSession(async ({ supabase }) => {
    const fields = saveBlackboardSchema.parse(input)
    const { data, error } = await supabase.rpc('save_student_blackboard', {
      p_student_id: fields.student_id,
      p_note_text: fields.note_text,
      p_expected_note_id: fields.note_id,
    })
    checkDatabaseError(error)
    checkRpcError(data)
    const rows = z.array(z.object({ id: z.uuid(), student_id: z.uuid(), teacher_id: z.uuid(), note_text: z.string(), created_at: z.string(), updated_at: z.string() })).parse(data)
    revalidateBackendPages()
    return rows[0] ?? null
  }, 'staff')
}
