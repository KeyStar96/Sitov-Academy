import 'server-only'
import { z } from 'zod'
import type { createAdminClient } from '@/utils/supabase/admin'
import { requiresSitovRecordingConsent } from '@/lib/sitov-recording-consent'

const coursesSchema = z.array(z.object({
  id: z.uuid().transform(value => value.toLowerCase()),
  type: z.enum(['online', 'presence']),
  category: z.enum(['german', 'speaking', 'online', 'private']),
  archived_at: z.literal(null),
})).min(1).max(100)

/** Only current persisted course records can establish a recording exception.
 * The registration RPC rechecks the rule atomically when creating the booking.
 */
export async function sitovCoursesRequireRecordingConsent(
  admin: ReturnType<typeof createAdminClient>, courseIds: readonly string[],
): Promise<boolean> {
  const selectedIds = courseIds.map(value => value.toLowerCase())
  const result = await admin.from('courses').select('id,type,category,archived_at')
    .in('id', selectedIds).is('archived_at', null)
  const courses = coursesSchema.safeParse(result.data)
  if (result.error || !courses.success) throw new Error('course_selection_unavailable')
  const storedIds = new Set(courses.data.map(course => course.id))
  if (courses.data.length !== selectedIds.length || storedIds.size !== selectedIds.length
    || selectedIds.some(courseId => !storedIds.has(courseId))) throw new Error('course_selection_unavailable')
  return courses.data.some(requiresSitovRecordingConsent)
}
