'use server'
import {revalidateTag} from 'next/cache'
import {withBackendSession,checkDatabaseError,revalidateBackendPages} from '@/lib/actions/backend'
import {courseEditorSchema,type CourseEditor} from '@/lib/business-courses'
import type {BackendActionResult} from '@/lib/types/backend'

export async function getCourseCatalog():Promise<BackendActionResult<CourseEditor[]>> {
 return withBackendSession(async({supabase})=>{
  const {data,error}=await supabase.from('courses').select('*, course_schedules(*), course_translations(*), course_exceptions(*)').order('sort_order').order('id')
  checkDatabaseError(error)
  return (data??[]).map(row=>courseEditorSchema.parse({
    id:row.id,slug:row.slug,title:row.title,description:row.description,type:row.type,category:row.category,level:row.level,unit_price:row.unit_price,
    unit_minutes:row.unit_minutes,start_date:row.start_date??'',end_date:row.end_date??'',trial_lessons:row.trial_lessons,sort_order:row.sort_order,archived:!!row.archived_at,
    schedules:row.course_schedules.map(s=>({weekday:s.weekday,start_time:s.start_time.slice(0,5),end_time:s.end_time.slice(0,5)})),
    translations:row.course_translations.map(t=>({locale:t.locale,title:t.title,description:t.description})),exceptions:row.course_exceptions.map(e=>({date:e.date,reason:e.reason})),
  }))
 },'staff')
}
export async function saveCourse(input:unknown):Promise<BackendActionResult<{id:string}>> {
 return withBackendSession(async({supabase})=>{
  const course=courseEditorSchema.parse(input)
  const {data,error}=await supabase.rpc('save_business_course',{p_data:course})
  checkDatabaseError(error)
  if(!data)throw new Error('course_save_failed')
  revalidateTag('courses',{expire:0});revalidateBackendPages()
  return {id:data}
 },'staff')
}
