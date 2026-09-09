'use server'

import {
  BackendError, checkDatabaseError, revalidateBackendPages, withBackendSession,
} from '@/lib/actions/backend'
import { uuidSchema, type BackendActionResult } from '@/lib/types/backend'
import {
  createTeacherNoteSchema, updateTeacherNoteSchema, listTeacherNotesSchema, saveBlackboardSchema,
  toTeacherNote, storedBlackboardNote, isEmptyBlackboard, type TeacherStudentNote,
} from '@/lib/types/teacher-notes'

export async function getTeacherNotes(input: unknown = {}): Promise<BackendActionResult<TeacherStudentNote[]>> {
  return withBackendSession(async ({ supabase }) => {
    const filters = listTeacherNotesSchema.parse(input)
    let query = supabase.from('teacher_student_notes').select('*')
    if (filters.student_id) query = query.eq('student_id', filters.student_id)
    const { data, error } = await query.order('id')
      .range(filters.offset, filters.offset + filters.limit - 1)
    checkDatabaseError(error)
    return (data ?? []).map(toTeacherNote)
  }, 'staff')
}

export async function createTeacherNote(input: unknown): Promise<BackendActionResult<TeacherStudentNote>> {
  return withBackendSession(async ({ supabase, userId }) => {
    const fields = createTeacherNoteSchema.parse(input)
    const { data, error } = await supabase.from('teacher_student_notes')
      .insert({ student_id: fields.student_id, note_text: fields.note_text,
        discount_percent: fields.discount_percent, teacher_id: userId }).select('*').single()
    checkDatabaseError(error)
    if (!data) throw new BackendError('not_found')
    revalidateBackendPages()
    return toTeacherNote(data)
  }, 'staff')
}

export async function updateTeacherNote(input: unknown): Promise<BackendActionResult<TeacherStudentNote>> {
  return withBackendSession(async ({ supabase }) => {
    const { id, ...changes } = updateTeacherNoteSchema.parse(input)
    const { data, error } = await supabase.from('teacher_student_notes').update(changes)
      .eq('id', id).select('*').single()
    checkDatabaseError(error)
    if (!data) throw new BackendError('not_found')
    revalidateBackendPages()
    return toTeacherNote(data)
  }, 'staff')
}

export async function deleteTeacherNote(input: unknown): Promise<BackendActionResult<{ id: string }>> {
  return withBackendSession(async ({ supabase }) => {
    const id = uuidSchema.parse(input)
    const { data, error } = await supabase.from('teacher_student_notes').delete()
      .eq('id', id).select('id').single()
    checkDatabaseError(error)
    if (!data) throw new BackendError('not_found')
    revalidateBackendPages()
    return data
  }, 'staff')
}

export async function saveBlackboardNote(
  input: unknown,
): Promise<BackendActionResult<TeacherStudentNote | null>> {
  return withBackendSession(async ({ supabase, userId }) => {
    const fields = saveBlackboardSchema.parse(input)
    if (isEmptyBlackboard(fields.note_text, fields.discount_percent)) {
      if (!fields.note_id) return null
      const { data, error } = await supabase.from('teacher_student_notes').delete()
        .eq('id', fields.note_id).select('id').single()
      checkDatabaseError(error)
      if (!data) throw new BackendError('not_found')
      revalidateBackendPages()
      return null
    }
    const noteText = storedBlackboardNote(fields.note_text)
    if (fields.note_id) {
      const { data, error } = await supabase.from('teacher_student_notes')
        .update({ note_text: noteText, discount_percent: fields.discount_percent })
        .eq('id', fields.note_id).select('*').single()
      checkDatabaseError(error)
      if (!data) throw new BackendError('not_found')
      revalidateBackendPages()
      return toTeacherNote(data)
    }
    const { data, error } = await supabase.from('teacher_student_notes')
      .insert({
        student_id: fields.student_id, teacher_id: userId,
        note_text: noteText, discount_percent: fields.discount_percent,
      }).select('*').single()
    checkDatabaseError(error)
    if (!data) throw new BackendError('not_found')
    revalidateBackendPages()
    return toTeacherNote(data)
  }, 'staff')
}
