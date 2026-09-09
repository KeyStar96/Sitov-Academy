import 'server-only'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { checkDatabaseError } from '@/lib/actions/backend'
import { resolveLegacyProfile } from '@/lib/profile-legacy'
import { profileMonthWindow } from '@/lib/profile-month'
import { monthlyBookingStatusSchema, type MonthlyCourseBooking, type ProfileMonthlyState } from '@/lib/types/monthly-bookings'
import type { User } from '@supabase/supabase-js'
import type { Tables } from '@/supabase/database.types'

const bookingRow = (row: Tables<'monthly_course_bookings'>): MonthlyCourseBooking => ({
  ...row, status: monthlyBookingStatusSchema.parse(row.status),
})

/** Only call with a user returned by auth.getUser(), never a request-supplied ID.
 * Legacy enrollments use an unrelated person ID. Shared/ambiguous emails are
 * not evidence of identity; never expose relatives' course selections.
 */
export async function loadProfileMonthlyState(
  supabase: Awaited<ReturnType<typeof createClient>>, user: User,
): Promise<ProfileMonthlyState> {
  const months = profileMonthWindow()
  const [catalog, next, previous] = await Promise.all([
    supabase.from('courses').select('id, booking_id, title, translation_key, type, start_date, end_date').order('id'),
    supabase.from('monthly_course_bookings').select('*').eq('user_id', user.id).eq('target_month', months.next).maybeSingle(),
    supabase.from('monthly_course_bookings').select('*').eq('user_id', user.id).lt('target_month', months.next)
      .order('target_month', { ascending: false }).limit(1).maybeSingle(),
  ])
  for (const response of [catalog, next, previous]) checkDatabaseError(response.error)
  const courses = (catalog.data ?? []).map(course => ({
    id: course.booking_id, title: course.title, translationKey: course.translation_key,
    type: course.type === 'online' ? 'online' as const : 'presence' as const,
    available: (!course.start_date || course.start_date < months.afterNext) && (!course.end_date || course.end_date >= months.next),
  }))
  const book = next.data ? bookingRow(next.data) : null
  const last = previous.data ? bookingRow(previous.data) : null
  if (book || last) {
    const selected = book ?? last!
    return {
      targetMonth: months.next, booking: book, courses,
      source: book ? 'booking' : 'previous',
      selection: {
        courseIds: selected.course_ids.filter(id => courses.some(course => course.id === id && (book || course.available))),
        paused: selected.status === 'cancelled',
      },
    }
  }
  let source: ProfileMonthlyState['source'] = 'empty'
  let ids: string[] = []
  const legacy = await resolveLegacyProfile(user)
  if (legacy.unresolved) source = 'unresolved'
  if (legacy.id) {
    const admin = createAdminClient()
    const registrations = await admin.from('registrations').select('id')
      .eq('user_id', legacy.id).eq('status', 'confirmed')
      .or(`start_date.is.null,start_date.lt.${months.next}`)
    checkDatabaseError(registrations.error)
    if (registrations.data?.length) {
      const enrolled = await admin.from('enrollments').select('course_id')
        .in('registration_id', registrations.data.map(row => row.id))
      checkDatabaseError(enrolled.error)
      const legacyIds = new Set((enrolled.data ?? []).map(row => row.course_id))
      ids = (catalog.data ?? []).filter(course => legacyIds.has(course.id)
        && (!course.start_date || course.start_date < months.next)
        && (!course.end_date || course.end_date >= months.next)).map(course => course.booking_id)
      source = 'enrollments'
    }
  }
  return { targetMonth: months.next, booking: null, courses, source, selection: { courseIds: ids, paused: false } }
}
