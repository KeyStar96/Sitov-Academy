'use server'

import { withBackendSession } from '@/lib/actions/backend'
import { loadProfileCourseCalendar } from '@/lib/profile-course-calendar-server'

export async function getProfileCourseCalendar() {
  return withBackendSession(({ supabase, user }) => loadProfileCourseCalendar(supabase, user))
}
