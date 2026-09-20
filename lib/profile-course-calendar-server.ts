import 'server-only'
import type { User } from '@supabase/supabase-js'
import type { createClient } from '@/utils/supabase/server'
import { checkDatabaseError } from '@/lib/actions/backend'
import { resolveVerifiedPerson } from '@/lib/profile-person'
import { profileMonthWindow } from '@/lib/profile-month'
import { buildProfileCourseCalendar, type ProfileCourseCalendarState } from '@/lib/profile-course-calendar'
import { readAllRows } from '@/lib/supabase-read'

/** The verified person is server-derived; cookie-scoped queries retain owner RLS. */
export async function loadProfileCourseCalendar(supabase: Awaited<ReturnType<typeof createClient>>, user: User, now = new Date()): Promise<ProfileCourseCalendarState> {
  const person = await resolveVerifiedPerson(user)
  if (!person.id) return { ...buildProfileCourseCalendar([], [], now), unresolved: person.unresolved }
  const { current, afterNext } = profileMonthWindow(now)
  const [bookings, exceptions] = await Promise.all([
    readAllRows(async (from, to) => {
      const result = await supabase.from('bookings')
        .select('id,kind,status,target_month,start_date,booking_items(course_id,title_snapshot,courses(id,title,start_date,end_date,course_schedules(id,weekday,start_time,end_time),course_translations(locale,title)))')
        .eq('person_id', person.id).in('status', ['pending', 'confirmed']).gte('target_month', current).lt('target_month', afterNext)
        .order('id').range(from, to)
      checkDatabaseError(result.error)
      return result
    }),
    readAllRows(async (from, to) => {
      const result = await supabase.from('course_exceptions').select('course_id,date,reason').gte('date', current).lt('date', afterNext)
        .order('id').range(from, to)
      checkDatabaseError(result.error)
      return result
    }),
  ])
  return buildProfileCourseCalendar(bookings, exceptions, now)
}
