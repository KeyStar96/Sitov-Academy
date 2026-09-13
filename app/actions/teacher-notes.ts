'use server'

import {
  BackendError, checkDatabaseError, revalidateBackendPages, withBackendSession,
} from '@/lib/actions/backend'
import { uuidSchema, type BackendActionResult } from '@/lib/types/backend'
import {
  createTeacherNoteSchema, updateTeacherNoteSchema, listTeacherNotesSchema, saveBlackboardSchema,
  toTeacherNote, type TeacherStudentNote,
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
  return withBackendSession(async ({ supabase }) => {
    const fields = saveBlackboardSchema.parse(input)
    // One transaction chooses/locks the central row, including simultaneous first
    // saves. Hidden legacy discount metadata is preserved directly in the DB.
    const { data, error } = await supabase.rpc('save_student_blackboard', {
      p_student_id: fields.student_id,
      p_note_text: fields.note_text,
      p_expected_note_id: fields.note_id,
    })
    checkDatabaseError(error)
    revalidateBackendPages()
    return data?.[0] ? toTeacherNote(data[0]) : null
  }, 'staff')
}
