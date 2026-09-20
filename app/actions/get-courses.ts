import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { readSupabaseServerConfig } from '@/lib/supabase-env'
import type { Database } from '@/supabase/database.types'
import type { CourseConfig } from '@/lib/course-config'
import { DAYS } from '@/lib/business-courses'

export const getCourses = unstable_cache(async ():Promise<CourseConfig[]> => {
  try {
    const {url,anonKey}=readSupabaseServerConfig()
    const supabase=createClient<Database>(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data,error}=await supabase.from('courses').select('*, course_schedules(*), course_translations(*)').is('archived_at',null).order('sort_order').order('id')
    if(error) throw error
    const today=new Date().toISOString().slice(0,10)
    return (data??[]).filter(row=>!row.end_date||row.end_date>=today).map(row=>({
      id:row.id,slug:row.slug,title:row.title,description:row.description,type:row.type==='online'?'online':'presence',unitPrice:Number(row.unit_price),
      category:row.category==='private'?'private':row.category==='speaking'?'speaking':row.category==='online'?'online':'german',
      sortOrder:row.sort_order,level:row.audience_code??row.level??undefined,unitMinutes:row.unit_minutes,
      startDate:row.start_date??undefined,endDate:row.end_date??undefined,trialLessons:row.trial_lessons,
      translations:row.course_translations.map(item=>({locale:item.locale,title:item.title,description:item.description})),
      sessions:row.course_schedules.sort((a,b)=>a.weekday-b.weekday||a.start_time.localeCompare(b.start_time)).map(item=>({
        day:DAYS[item.weekday-1],startTime:item.start_time.slice(0,5),endTime:item.end_time.slice(0,5),
      })),
    }))
  }catch {console.error('[courses] Catalog unavailable');return []}
},['vps-catalog'],{revalidate:300,tags:['courses']})
