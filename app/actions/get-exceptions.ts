'use server'
import {createClient} from '@/utils/supabase/server'
import type {CourseException} from '@/lib/course-config'
export async function getExceptions():Promise<CourseException[]> {
 try {const client=await createClient();const {data,error}=await client.from('course_exceptions').select('*');if(error)throw error;
 return (data??[]).map(row=>({date:row.date,reason:row.reason,courseIds:row.course_id?[row.course_id]:undefined}))
 }catch{console.error('[courses] Calendar unavailable');return []}
}
