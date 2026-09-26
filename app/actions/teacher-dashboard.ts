'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { LOCALES } from '@/lib/locale-routing'
import { teacherStudentSchema, teacherTabSchema, teacherDetailSchemas, teacherInterventionSchema,
  type TeacherStudent, type TeacherTab, type TeacherDetailData, type TeacherIntervention, type TeacherResult } from '@/lib/teacher-dashboard-contract'

/** User-cookie identity only. Every RPC independently enforces staff authorization. */
async function session() {
  const client = await createClient()
  const { data, error } = await client.auth.getUser()
  return error || !data.user ? null : client
}
function parseResult<T>(data: unknown, schema: z.ZodType<T>): TeacherResult<T> {
  const failure = z.object({ error: z.string() }).safeParse(data)
  if (failure.success) return { error: failure.data.error }
  const result = schema.safeParse(data)
  return result.success ? { data: result.data } : { error: 'invalid_response' }
}
function rpcError(code: string) {
  return ['PGRST202', '42883'].includes(code) ? 'backend_unavailable' : 'request_failed'
}
export async function getTeacherStudents(): Promise<TeacherResult<TeacherStudent[]>> {
  try {
    const client = await session()
    if (!client) return { error: 'authentication_required' }
    const { data, error } = await client.rpc('get_teacher_dashboard_students')
    if (error) return { error: rpcError(error.code) }
    const parsed = parseResult(data, z.object({ success: z.literal(true), students: z.array(teacherStudentSchema) }))
    return parsed.data ? { data: parsed.data.students } : { error: parsed.error }
  } catch { return { error: 'request_failed' } }
}
export async function getTeacherStudentDetail<K extends TeacherTab>(studentId: string, tab: K, locale: string): Promise<TeacherResult<TeacherDetailData[K]>> {
  if (!z.string().uuid().safeParse(studentId).success || !teacherTabSchema.safeParse(tab).success || !z.enum(LOCALES).safeParse(locale).success)
    return { error: 'invalid_input' }
  try {
    const client = await session()
    if (!client) return { error: 'authentication_required' }
    const { data, error } = await client.rpc('get_teacher_student_detail', { p_student_id: studentId, p_tab: tab, p_locale: locale })
    if (error) return { error: rpcError(error.code) }
    const schema = teacherDetailSchemas[tab] as unknown as z.ZodType<TeacherDetailData[K]>
    const parsed = parseResult(data, z.object({ success: z.literal(true), data: schema }))
    return parsed.data ? { data: parsed.data.data } : { error: parsed.error }
  } catch { return { error: 'request_failed' } }
}
export async function interveneTeacherPath(input: TeacherIntervention): Promise<TeacherResult<{ success: true }>> {
  const parsed = teacherInterventionSchema.safeParse(input)
  if (!parsed.success) return { error: 'invalid_input' }
  try {
    const client = await session()
    if (!client) return { error: 'authentication_required' }
    const { studentId, unitId, nodeId, action, requestId } = parsed.data
    const { data, error } = await client.rpc('manage_learning_path', { p_student_id: studentId, p_unit_id: unitId,
      p_node_id: nodeId, p_action: action, p_request_id: requestId })
    if (error) return { error: rpcError(error.code) }
    const result = parseResult(data, z.object({ success: z.literal(true) }))
    if (result.data) {
      revalidatePath('/[lang]/admin/students', 'page')
      revalidatePath('/[lang]/admin/students/[id]', 'page')
      revalidatePath('/[lang]/dashboard/level/[level]/exercises', 'page')
    }
    return result
  } catch { return { error: 'request_failed' } }
}
