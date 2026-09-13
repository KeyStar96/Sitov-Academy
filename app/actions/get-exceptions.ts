import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { readSupabaseServerConfig } from '@/lib/supabase-env'
import type { Database } from '@/supabase/database.types'
import type { CourseException } from '@/lib/course-config'

/** Public calendar data must not read session cookies during prerendering. */
export const getExceptions = unstable_cache(async (): Promise<CourseException[]> => {
  try {
    const { url, anonKey } = readSupabaseServerConfig()
    const client = createClient<Database>(url, anonKey, { auth: { persistSession:false, autoRefreshToken:false } })
    const { data, error } = await client.from('course_exceptions').select('*').order('date').order('id')
    if (error) throw error
    return (data ?? []).map(row => ({ date:row.date, reason:row.reason, courseIds:row.course_id ? [row.course_id] : undefined }))
  } catch {
    console.error('[courses] Calendar unavailable')
    return []
  }
}, ['vps-calendar'], { revalidate:300, tags:['courses'] })
