'use server'

import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { BackendError, checkDatabaseError, checkRpcError, revalidateBackendPages, withBackendSession } from '@/lib/actions/backend'
import { readAllRows } from '@/lib/supabase-read'
import { isCalendarDate, type CancellationCourse, type CancellationData, type CancellationEntry } from '@/lib/course-cancellations'
import type { BackendActionResult } from '@/lib/types/backend'

/**
 * Kursausfälle zentral pflegen. Alle Schreibzugriffe laufen über die
 * bestehenden Staff-RPCs `save_course_exception` (Upsert je Kurs und Tag) und
 * `delete_course_exception`. Datenbank-Trigger informieren Schüler bei
 * künftigen Terminen per E-Mail und berechnen offene Monatsbuchungen neu.
 * Ganztägige Ausfälle werden als ein Eintrag je betroffenem Kurs gespeichert –
 * so bleiben sie einzeln rücknehmbar und benötigen keine Schemaänderung.
 */
const day = z.string().refine(isCalendarDate)
const reason = z.string().trim().min(1).max(250).refine(value => !/[<>\u0000-\u001f]/.test(value))
const id = z.uuid()
const singleInput = z.object({ courseId: id, date: day, reason }).strict()
const wholeDayInput = z.object({ date: day, reason, courseIds: z.array(id).min(1).max(100).refine(ids => new Set(ids).size === ids.length) }).strict()
const restoreInput = z.object({ id }).strict()
const savedSchema = z.object({ id })

function revalidateCalendar() {
  revalidateTag('courses', { expire: 0 })
  revalidateBackendPages()
}

type CourseRow = {
  id: string; title: string; type: CancellationCourse['type']; category: CancellationCourse['category']
  audience_code: string | null; level: string | null; start_date: string | null; end_date: string | null; archived_at: string | null
  course_schedules: { weekday: number; start_time: string; end_time: string }[]
}

export async function getCourseCancellationData(): Promise<BackendActionResult<CancellationData>> {
  return withBackendSession(async ({ supabase }) => {
    const [courses, exceptions] = await Promise.all([
      readAllRows<CourseRow>((from, to) => supabase.from('courses')
        .select('id,title,type,category,audience_code,level,start_date,end_date,archived_at,course_schedules(weekday,start_time,end_time)')
        .order('sort_order').order('id').range(from, to)),
      readAllRows<{ id: string; date: string; reason: string; course_id: string | null }>((from, to) => supabase.from('course_exceptions')
        .select('id,date,reason,course_id').order('date').order('id').range(from, to)),
    ])
    return {
      courses: courses.map(row => ({
        id: row.id, title: row.title, type: row.type, category: row.category, level: row.audience_code ?? row.level ?? '',
        startDate: row.start_date, endDate: row.end_date, archived: Boolean(row.archived_at),
        schedules: (row.course_schedules ?? [])
          .map(schedule => ({ weekday: schedule.weekday, start: schedule.start_time.slice(0, 5), end: schedule.end_time.slice(0, 5) }))
          .sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start)),
      })),
      cancellations: exceptions.map((row): CancellationEntry => ({ id: row.id, date: row.date, reason: row.reason, courseId: row.course_id })),
    }
  }, 'staff')
}

export async function cancelCourseDate(input: unknown): Promise<BackendActionResult<{ id: string }>> {
  return withBackendSession(async ({ supabase }) => {
    const value = singleInput.parse(input)
    const { data, error } = await supabase.rpc('save_course_exception', { p_course_id: value.courseId, p_date: value.date, p_reason: value.reason })
    checkDatabaseError(error)
    checkRpcError(data)
    const saved = savedSchema.parse(data)
    revalidateCalendar()
    return saved
  }, 'staff')
}

export async function cancelWholeDay(input: unknown): Promise<BackendActionResult<{ results: Array<{ courseId: string; saved: boolean }> }>> {
  return withBackendSession(async ({ supabase }) => {
    const value = wholeDayInput.parse(input)
    // Nur vorhandene, nicht archivierte Kurse – sonst wird nichts geschrieben.
    const { data: known, error } = await supabase.from('courses').select('id,archived_at').in('id', value.courseIds)
    checkDatabaseError(error)
    const active = new Set((known ?? []).filter(row => !row.archived_at).map(row => row.id))
    if (value.courseIds.some(courseId => !active.has(courseId))) throw new BackendError('invalid_input')
    const results: Array<{ courseId: string; saved: boolean }> = []
    // Nacheinander: Jeder Aufruf ist für sich atomar; ein Teilfehler bleibt sichtbar.
    for (const courseId of value.courseIds) {
      try {
        const response = await supabase.rpc('save_course_exception', { p_course_id: courseId, p_date: value.date, p_reason: value.reason })
        checkDatabaseError(response.error)
        checkRpcError(response.data)
        savedSchema.parse(response.data)
        results.push({ courseId, saved: true })
      } catch {
        results.push({ courseId, saved: false })
      }
    }
    if (results.some(result => result.saved)) revalidateCalendar()
    return { results }
  }, 'staff')
}

export async function restoreCancellation(input: unknown): Promise<BackendActionResult<{ deleted: true }>> {
  return withBackendSession(async ({ supabase }) => {
    const value = restoreInput.parse(input)
    const { data, error } = await supabase.rpc('delete_course_exception', { p_id: value.id })
    checkDatabaseError(error)
    checkRpcError(data)
    revalidateCalendar()
    return { deleted: true as const }
  }, 'staff')
}
