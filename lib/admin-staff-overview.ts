import 'server-only'

import { createAdminClient } from '@/utils/supabase/admin'
import { checkDatabaseError } from '@/lib/actions/backend'
import { profileMonthWindow } from '@/lib/profile-month'
import { monthlyBookingStatusSchema, type MonthlyCourseBooking } from '@/lib/types/monthly-bookings'
import { toTeacherNote, type TeacherStudentNote } from '@/lib/types/teacher-notes'
import type { CatalogCourse, NextMonthOverview, StaffStudentContact } from '@/lib/types/admin-staff'
import { buildNextMonthOverview, notesByStudent } from '@/lib/admin-next-month'
import type { Tables } from '@/supabase/database.types'

async function fetchAll<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { code: string } | null }>,
): Promise<T[]> {
  const pageSize = 1000
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await run(from, from + pageSize - 1)
    checkDatabaseError(error)
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

function toBooking(row: Tables<'monthly_course_bookings'>): MonthlyCourseBooking {
  return { ...row, status: monthlyBookingStatusSchema.parse(row.status) }
}

function toContact(row: Tables<'profiles'>): StaffStudentContact {
  return {
    id: row.id, name: row.name, email: row.email, phone: row.phone,
    street: row.street, zip_code: row.zip_code, city: row.city,
  }
}

function toCatalog(row: Tables<'courses'>): CatalogCourse {
  return {
    bookingId: row.booking_id, title: row.title, translationKey: row.translation_key,
    type: row.type === 'online' ? 'online' : 'presence',
    startDate: row.start_date, endDate: row.end_date,
  }
}

export async function loadStaffBlackboardNotes(): Promise<Record<string, TeacherStudentNote>> {
  const admin = createAdminClient()
  const rows = await fetchAll<Tables<'teacher_student_notes'>>((from, to) =>
    admin.from('teacher_student_notes').select('*').order('id').range(from, to))
  return notesByStudent(rows.map(toTeacherNote))
}

export async function loadNextMonthStaffOverview(): Promise<NextMonthOverview> {
  const admin = createAdminClient()
  const months = profileMonthWindow()
  const [profiles, bookings, courses, notes] = await Promise.all([
    fetchAll<Tables<'profiles'>>((from, to) =>
      admin.from('profiles').select('*').eq('role', 'student').order('id').range(from, to)),
    fetchAll<Tables<'monthly_course_bookings'>>((from, to) =>
      admin.from('monthly_course_bookings').select('*').order('target_month').order('id').range(from, to)),
    fetchAll<Tables<'courses'>>((from, to) =>
      admin.from('courses').select('*').order('id').range(from, to)),
    loadStaffBlackboardNotes(),
  ])
  return buildNextMonthOverview({
    targetMonth: months.next,
    afterNext: months.afterNext,
    students: profiles.map(toContact),
    bookings: bookings.map(toBooking),
    catalog: courses.map(toCatalog),
    notes,
  })
}
