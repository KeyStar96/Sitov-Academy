'use server'

import { z } from 'zod'
import { readAllRows } from '@/lib/supabase-read'
import { grammarLessonLabel, type AvailableLessonsResult } from '@/lib/access/units'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sanitizeAllowedLevels, ACCESS_LEVELS, TRAINERS } from '@/lib/access/levels'
import { withBackendSession, checkDatabaseError, checkRpcError, revalidateBackendPages } from '@/lib/actions/backend'
import { profileRoleSchema, uuidSchema } from '@/lib/types/backend'

// Helper to check if current user is admin/teacher
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
    
  if (profile?.role !== 'admin' && profile?.role !== 'teacher') {
    throw new Error('Not authorized')
  }
}

export async function getAdminStats() {
  try {
    await requireAdmin()
    const supabase = createAdminClient()
    
    // Get total students
    const { count: studentCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'student')

    // Freigeschaltete Nutzer: mind. ein Sprachniveau freigegeben.
    const { count: activatedCount } = await supabase
      .from('profiles')
      .select('id,student_level_access!inner(auth_user_id)', { count: 'exact', head: true })

    // Get pending submissions
    const { count: pendingSubmissions } = await supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      
    return {
      studentCount: studentCount || 0,
      activatedCount: activatedCount || 0,
      pendingSubmissions: pendingSubmissions || 0
    }
  } catch (error) {
    console.error('Error fetching admin stats', error)
    return { studentCount: 0, activatedCount: 0, pendingSubmissions: 0 }
  }
}

export async function getStudents() {
  try {
    await requireAdmin()
    const supabase = createAdminClient()
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id,role,created_at,person:people(*),level_access:student_level_access(level)')
      .order('created_at', { ascending: false })
      
    if (error) throw error
    const { data: rules, error: rulesError } = await supabase.from('learning_trainer_grants').select('auth_user_id,level,trainer,enabled,unit_mode,units:learning_unit_grants(unit_id)')
    if (rulesError) throw rulesError
    return (data ?? []).map(student => ({ ...student, role: profileRoleSchema.nullable().parse(student.role), allowed_levels: student.level_access.map(access => access.level), trainer_grants: (rules ?? []).filter(rule => rule.auth_user_id === student.id).map(rule => ({ level: rule.level, trainer: rule.trainer, enabled: rule.enabled, unit_ids: rule.unit_mode === 'all' ? null : rule.units.map(item => item.unit_id) })) }))
  } catch (error) {
    console.error('Error fetching students', error)
    return []
  }
}

export async function updateStudentRole(userId: string, role: string) {
  return withBackendSession(async () => {
    const id = uuidSchema.parse(userId)
    const validRole = profileRoleSchema.parse(role)
    // Role changes require an admin; teachers retain the other staff actions.
    const { data, error } = await createAdminClient().from('profiles')
      .update({ role: validRole }).eq('id', id).select('id').single()
    checkDatabaseError(error)
    revalidateBackendPages()
    return data
  }, 'admin')
}

/**
 * Setzt die pro Nutzer freigeschalteten Sprachniveaus.
 *
 * Nur bekannte, gültige Niveaus werden übernommen (sanitize) – so kann der
 * Client keine beliebigen Werte in `allowed_levels` schreiben. Ein leeres Array
 * entzieht den Zugriff vollständig.
 */
export async function updateStudentAllowedLevels(userId: string, levels: string[]) {
  try {
    await requireAdmin()
    const supabase = await createClient()

    const allowedLevels = sanitizeAllowedLevels(levels)

    const { data, error } = await supabase.rpc('set_student_level_access', { p_user_id: uuidSchema.parse(userId), p_levels: allowedLevels })

    if (error) throw error
    checkRpcError(data)
    revalidatePath('/[lang]/admin/students', 'page')
    return { success: true, allowedLevels }
  } catch (error) {
    console.error('Error updating allowed levels', error)
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return { success: false, error: message }
  }
}

export async function getAllStudentsProgressData() {
  try {
    await requireAdmin()
    const supabase = await createClient()
    
    const { data, error } = await supabase.rpc('get_all_students_progress_data')
    if (error) throw error

    return data as Record<string, Record<string, number>>
  } catch (error) {
    console.error('Error fetching progress data for all students', error)
    return {}
  }
}

export async function resetStudentProgress(userId: string, level: string) {
  try {
    await requireAdmin()
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('reset_student_level_progress', {
      p_student_id: uuidSchema.parse(userId), p_level: z.enum(ACCESS_LEVELS).parse(level),
    })
    if (error) throw error
    checkRpcError(data)
    revalidatePath('/[lang]/admin/students', 'page')
    return { success: true }
  } catch (error) {
    console.error('Error resetting student progress', error)
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return { success: false, error: message }
  }
}

const trainerAccessInput = z.object({ userId: z.uuid(), level: z.enum(ACCESS_LEVELS), trainer: z.enum(TRAINERS), enabled: z.boolean(), allowedLessons: z.array(z.string().trim().min(1).max(160)).max(1000).nullable().optional() }).strict()
export async function updateStudentTrainerAccess(input: z.infer<typeof trainerAccessInput>): Promise<{ success: boolean }> {
  try {
    await requireAdmin()
    const parsed = trainerAccessInput.parse(input)
    if (parsed.allowedLessons != null) {
      const catalog = await getAvailableLessons(parsed.level, parsed.trainer)
      if (!catalog.success || parsed.allowedLessons.some(id => !catalog.lessons.some(unit => unit.id === id))) return { success: false }
    }
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('set_student_trainer_access', {
      p_user_id: parsed.userId, p_level: parsed.level, p_trainer: parsed.trainer, p_enabled: parsed.enabled,
      p_unit_ids: parsed.allowedLessons === undefined ? null : parsed.allowedLessons,
      p_replace_units: parsed.allowedLessons !== undefined,
    })
    if (error) throw error
    checkRpcError(data)
    revalidatePath('/[lang]/admin/students', 'page')
    revalidatePath('/[lang]/dashboard', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Trainer access update failed:', error)
    return { success: false }
  }
}

export async function getAvailableLessons(level: string, trainer: string): Promise<AvailableLessonsResult> {
  try {
    await requireAdmin()
    const validLevel = z.enum(ACCESS_LEVELS).parse(level)
    const validTrainer = z.enum(TRAINERS).parse(trainer)
    const supabase = await createClient()
    const { data: units, error } = await supabase.from('learning_units').select('id,label')
      .eq('level', validLevel).eq('trainer', validTrainer).eq('is_active', true).order('sort_order').order('id')
    if (error) throw error
    const topics = new Map<string, Set<string>>()
    if (validTrainer === 'exercises') {
      const { data, error: contentError } = await supabase.from('learning_exercises').select('unit_id,topic,unit:learning_units!inner(level)').eq('unit.level', validLevel)
      if (contentError) throw contentError
      for (const row of data ?? []) {
        if (!row.unit_id || !row.topic) continue
        const values = topics.get(row.unit_id) ?? new Set<string>()
        values.add(row.topic)
        topics.set(row.unit_id, values)
      }
    }
    return { success: true, lessons: (units ?? []).map(unit => ({
      id: unit.id, label: validTrainer === 'exercises' ? grammarLessonLabel(unit.label, [...(topics.get(unit.id) ?? [])]) : unit.label,
    })) }

  } catch (error) {
    console.error('Failed to get available lessons:', error)
    return { success: false }
  }
}
