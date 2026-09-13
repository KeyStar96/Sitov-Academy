import { z } from 'zod'
import type { Tables } from '@/supabase/database.types'
import { uuidSchema } from './backend'

export type TeacherStudentNote = Tables<'teacher_student_notes'>
export function displayBlackboardNote(text: string | null | undefined): string {
  return text?.trim() ?? ''
}
const noteTextSchema = z.string().max(5000)
  .transform(value => value.replace(/\r\n?/g, '\n').trim())
  .pipe(z.string().max(5000).refine(value => !/[<>\u0000-\u0008\u000B-\u001F\u007F]/u.test(value)))
export const saveBlackboardSchema = z.object({
  student_id: uuidSchema,
  note_id: uuidSchema.nullable(),
  note_text: noteTextSchema,
}).strict()
export type SaveBlackboardInput = z.input<typeof saveBlackboardSchema>
