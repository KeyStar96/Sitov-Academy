import { z } from 'zod'
import type { Tables, TablesInsert, TablesUpdate } from '@/supabase/database.types'
import { plainTextSchema, uuidSchema } from './backend'

export type TeacherStudentNote = Tables<'teacher_student_notes'>
export type TeacherStudentNoteInsert = TablesInsert<'teacher_student_notes'>
export type TeacherStudentNoteUpdate = TablesUpdate<'teacher_student_notes'>
const discountPercentSchema = z.number().min(0).max(100).multipleOf(0.01)
export const createTeacherNoteSchema = z.object({
  student_id: uuidSchema,
  note_text: plainTextSchema(5000),
  discount_percent: discountPercentSchema.default(0),
}).strict()
export const updateTeacherNoteSchema = z.object({
  id: uuidSchema,
  note_text: plainTextSchema(5000).optional(),
  discount_percent: discountPercentSchema.optional(),
}).strict().refine(value => value.note_text !== undefined || value.discount_percent !== undefined)
export const listTeacherNotesSchema = z.object({
  student_id: uuidSchema.optional(),
  offset: z.number().int().min(0).max(1_000_000).default(0),
  limit: z.number().int().min(1).max(100).default(50),
}).strict()
export type CreateTeacherNoteInput = z.input<typeof createTeacherNoteSchema>
export type UpdateTeacherNoteInput = z.input<typeof updateTeacherNoteSchema>
export type ListTeacherNotesInput = z.input<typeof listTeacherNotesSchema>
