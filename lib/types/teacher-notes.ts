import { z } from 'zod'
import type { Tables, TablesInsert, TablesUpdate } from '@/supabase/database.types'
import { plainTextSchema, uuidSchema } from './backend'

export type TeacherStudentNote = Tables<'teacher_student_notes'>
export type TeacherStudentNoteInsert = TablesInsert<'teacher_student_notes'>
export type TeacherStudentNoteUpdate = TablesUpdate<'teacher_student_notes'>
const discountPercentSchema = z.number().min(0).max(100).multipleOf(0.01)
/** The table CHECK requires 1–5000 characters; this joiner stands in for an empty board. */
export const BLACKBOARD_EMPTY_NOTE = '\u2060'
export function toTeacherNote(row: Tables<'teacher_student_notes'>): TeacherStudentNote {
  const discount = Number(row.discount_percent)
  return { ...row, discount_percent: Number.isFinite(discount) ? discount : 0 }
}
export function displayBlackboardNote(text: string | null | undefined): string {
  if (!text) return ''
  return text.split(BLACKBOARD_EMPTY_NOTE).join('').trim()
}
export function storedBlackboardNote(text: string): string {
  const prose = displayBlackboardNote(text)
  return prose.length > 0 ? prose : BLACKBOARD_EMPTY_NOTE
}
export function isEmptyBlackboard(text: string, discount: number): boolean {
  return displayBlackboardNote(text).length === 0 && discount === 0
}
export function parseDiscountInput(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.')
  if (normalized === '') return 0
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0 || value > 100) return null
  return Math.round(value * 100) / 100
}
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
const blackboardTextSchema = z.string().max(5000)
  .transform(value => value.replace(/\r\n?/g, '\n').trim())
  .pipe(z.string().max(5000).refine(value => !/[<>\u0000-\u0008\u000B-\u001F\u007F]/u.test(value)))
export const saveBlackboardSchema = z.object({
  student_id: uuidSchema,
  note_id: uuidSchema.nullable(),
  note_text: blackboardTextSchema,
  discount_percent: z.number().min(0).max(100)
    .transform(value => Math.round(value * 100) / 100)
    .pipe(discountPercentSchema),
}).strict()
export type CreateTeacherNoteInput = z.input<typeof createTeacherNoteSchema>
export type UpdateTeacherNoteInput = z.input<typeof updateTeacherNoteSchema>
export type ListTeacherNotesInput = z.input<typeof listTeacherNotesSchema>
export type SaveBlackboardInput = z.input<typeof saveBlackboardSchema>
