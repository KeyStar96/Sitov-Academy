import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { readSupabaseServerConfig } from '@/lib/supabase-env'
import type { Database } from '@/supabase/database.types'
import type { CourseException } from '@/lib/course-config'
import { readAllRows } from '@/lib/supabase-read'

/** Public calendar data must not read session cookies during prerendering. */
export const getExceptions = unstable_cache(async (): Promise<CourseException[]> => {
  try {
    const { url, anonKey } = readSupabaseServerConfig()
    const client = createClient<Database>(url, anonKey, { auth: { persistSession:false, autoRefreshToken:false } })
    const data = await readAllRows((from, to) => client.from('course_exceptions').select('*').order('date').order('id').range(from, to))
    return data.map(row => ({ date:row.date, reason:row.reason, courseIds:row.course_id ? [row.course_id] : undefined }))
  } catch {
    console.error('[courses] Calendar unavailable')
    // Missing calendar data must not look like a month without cancellations.
    throw new Error('course_calendar_unavailable')
  }
}, ['vps-calendar'], { revalidate:300, tags:['courses'] })
