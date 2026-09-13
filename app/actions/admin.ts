'use server'

import { z } from 'zod'
import { grammarLessonLabel, type AvailableLessonsResult } from '@/lib/access/units'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sanitizeAllowedLevels, ACCESS_LEVELS, TRAINERS } from '@/lib/access/levels'
import { withBackendSession, checkDatabaseError, revalidateBackendPages } from '@/lib/actions/backend'
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
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student')

    // Freigeschaltete Nutzer: mind. ein Sprachniveau freigegeben.
    const { count: activatedCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .not('allowed_levels', 'eq', '{}')

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
      .select('*, student_trainer_access(level,trainer,enabled,allowed_lessons)')
      .order('created_at', { ascending: false })
      
    if (error) throw error
    return data || []
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
    const supabase = createAdminClient()

    const allowedLevels = sanitizeAllowedLevels(levels)

    const { error } = await supabase
      .from('profiles')
      .update({ allowed_levels: allowedLevels })
      .eq('id', userId)

    if (error) throw error

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
    const supabase = createAdminClient()
    
    // 1. Hole alle Übungen und deren Level
    const { data: exercises } = await supabase.from('exercises').select('id, level')
    
    // 2. Hole alle Vokabelkarten und deren Level
    const { data: vocabCards } = await supabase.from('vocabulary_cards').select('id, level')

    // 3. Hole den Fortschritt ALLER User für Übungen
    const { data: exerciseProgress } = await supabase
      .from('user_exercise_progress')
      .select('user_id, exercise_id')
      .eq('completed', true)

    // 4. Hole den Fortschritt ALLER User für Vokabeln (Box 7 = gemeistert)
    const { data: vocabProgress } = await supabase
      .from('user_vocabulary_progress')
      .select('user_id, card_id')
      .eq('box_number', 7)

    // Maps
    const exerciseLevelMap = new Map((exercises || []).map(e => [e.id, e.level]))
    const vocabLevelMap = new Map((vocabCards || []).map(v => [v.id, v.level]))

    // Total per level
    const totalPerLevel: Record<string, number> = {}
    exercises?.forEach(e => { totalPerLevel[e.level] = (totalPerLevel[e.level] || 0) + 1 })
    vocabCards?.forEach(v => { totalPerLevel[v.level] = (totalPerLevel[v.level] || 0) + 1 })

    // Completed per user per level
    const userCompletedPerLevel: Record<string, Record<string, number>> = {}
    
    exerciseProgress?.forEach(p => {
      const level = exerciseLevelMap.get(p.exercise_id)
      if (level) {
        if (!userCompletedPerLevel[p.user_id]) userCompletedPerLevel[p.user_id] = {}
        userCompletedPerLevel[p.user_id][level] = (userCompletedPerLevel[p.user_id][level] || 0) + 1
      }
    })

    vocabProgress?.forEach(p => {
      const level = vocabLevelMap.get(p.card_id)
      if (level) {
        if (!userCompletedPerLevel[p.user_id]) userCompletedPerLevel[p.user_id] = {}
        userCompletedPerLevel[p.user_id][level] = (userCompletedPerLevel[p.user_id][level] || 0) + 1
      }
    })

    // Compute percentages
    const result: Record<string, Record<string, number>> = {}
    Object.keys(userCompletedPerLevel).forEach(userId => {
      result[userId] = {}
      Object.keys(totalPerLevel).forEach(level => {
        const total = totalPerLevel[level] || 0
        if (total > 0) {
          const completed = userCompletedPerLevel[userId][level] || 0
          result[userId][level] = Math.round((completed / total) * 100)
        }
      })
    })

    return result
  } catch (error) {
    console.error('Error fetching progress data for all students', error)
    return {}
  }
}

export async function resetStudentProgress(userId: string, level: string) {
  try {
    await requireAdmin()
    const supabase = createAdminClient()

    // 1. Hole alle Übungen für das Level
    const { data: exercises } = await supabase
      .from('exercises')
      .select('id')
      .eq('level', level)

    const exerciseIds = exercises?.map(e => e.id) || []

    if (exerciseIds.length > 0) {
      await supabase
        .from('user_exercise_progress')
        .delete()
        .eq('user_id', userId)
        .in('exercise_id', exerciseIds)
    }

    // 2. Hole alle Vokabelkarten für das Level
    const { data: vocabCards } = await supabase
      .from('vocabulary_cards')
      .select('id')
      .eq('level', level)

    const vocabIds = vocabCards?.map(v => v.id) || []

    if (vocabIds.length > 0) {
      await supabase
        .from('user_vocabulary_progress')
        .delete()
        .eq('user_id', userId)
        .in('card_id', vocabIds)
    }

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
    const { error } = await supabase.from('student_trainer_access').upsert({
      user_id: parsed.userId, level: parsed.level, trainer: parsed.trainer, enabled: parsed.enabled,
      ...(parsed.allowedLessons !== undefined ? { allowed_lessons: parsed.allowedLessons === null ? null : [...new Set(parsed.allowedLessons)] } : {}),
    }, { onConflict: 'user_id,level,trainer' })
    if (error) throw error
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
    if (validTrainer === 'pronunciation') {
      const { data, error } = await supabase.from('pronunciation_prompts').select('id,title,sentence_de').eq('level', validLevel).eq('is_active', true).order('sort_order').order('id')
      if (error) throw error
      return { success: true, lessons: (data ?? []).map(row => ({ id: row.id, label: row.title?.trim() || row.sentence_de.slice(0, 90) })) }
    }
    if (validTrainer === 'videos') return { success: true, lessons: [] }
    const lessons = new Map<string, Set<string>>()
    for (let offset = 0; ; offset += 500) {
      const { data, error } = validTrainer === 'exercises'
        ? await supabase.from('exercises').select('lesson,topic').eq('level', validLevel).order('id').range(offset, offset + 499)
        : await supabase.from('vocabulary_cards').select('lesson').eq('level', validLevel).order('id').range(offset, offset + 499)
      if (error) throw error
      for (const row of data ?? []) {
        const topics = lessons.get(row.lesson) ?? new Set<string>()
        if ('topic' in row && typeof row.topic === 'string') topics.add(row.topic)
        lessons.set(row.lesson, topics)
      }
      if (!data || data.length < 500) break
    }
    return { success: true, lessons: [...lessons].sort(([a], [b]) => a.localeCompare(b, 'de', { numeric: true })).map(([id, topics]) => ({
      id, label: validTrainer === 'exercises' ? grammarLessonLabel(id, [...topics]) : id,
    })) }
  } catch (error) {
    console.error('Failed to get available lessons:', error)
    return { success: false }
  }
}
