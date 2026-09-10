import 'server-only'
import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { resolveLegacyProfile } from './profile-legacy'
import { checkDatabaseError } from './actions/backend'
import type { VerifiedCourseHistory } from './types/admin-registrations'
import { z } from 'zod'

/** user must originate from auth.getUser(); no identity fields are accepted from
 * query parameters. Authenticated monthly bookings remain protected by RLS. */
export async function loadVerifiedCourseHistory(user:User):Promise<VerifiedCourseHistory|null> {
  if(!user.email_confirmed_at)return {unresolved:false,registrations:[]}
  const legacy=await resolveLegacyProfile(user)
  const supabase=await createClient()
  const [monthly,catalog]=await Promise.all([
    supabase.from('monthly_course_bookings').select('*').eq('user_id',user.id).order('target_month',{ascending:false}),
    supabase.from('courses').select('id,booking_id,title,translation_key,end_date'),
  ])
  checkDatabaseError(monthly.error);checkDatabaseError(catalog.error)
  const courseByBooking=new Map((catalog.data??[]).map(course=>[course.booking_id,course]))
  const courseById=new Map((catalog.data??[]).map(course=>[course.id,course]))
  const result:VerifiedCourseHistory={unresolved:legacy.unresolved,registrations:(monthly.data??[]).map(booking=>({
    id:booking.id,status:z.enum(['pending','confirmed','cancelled']).parse(booking.status),startDate:booking.target_month,
    courses:booking.course_ids.map(id=>{const course=courseByBooking.get(id);return {id,title:course?.title??id,translationKey:course?.translation_key??'',price:null,endDate:course?.end_date??null}}),
  }))}
  if(!legacy.id)return result
  const admin=createAdminClient()
  const person = await admin.from('users').select('birth_date').eq('id', legacy.id).single()
  checkDatabaseError(person.error)
  result.birthDate = person.data?.birth_date ?? null
  const registered=await admin.from('registrations').select('id,status,start_date,course_ids').eq('user_id',legacy.id).order('created_at',{ascending:false})
  checkDatabaseError(registered.error)
  const registeredIds=(registered.data??[]).map(row=>row.id)
  const enrolled=registeredIds.length?await admin.from('enrollments').select('registration_id,course_id,price').in('registration_id',registeredIds):{data:[],error:null}
  checkDatabaseError(enrolled.error)
  result.registrations.push(...(registered.data??[]).map(registration=>({id:registration.id,status:z.enum(['pending','confirmed','cancelled','rejected']).parse(registration.status),startDate:registration.start_date,
    courses:[...new Set([...(registration.course_ids??[]),...(enrolled.data??[]).filter(row=>row.registration_id===registration.id).map(row=>row.course_id)])].map(id=>{const course=courseById.get(id);return {id,title:course?.title??id,translationKey:course?.translation_key??'',price:(enrolled.data??[]).find(row=>row.registration_id===registration.id&&row.course_id===id)?.price??null,endDate:course?.end_date??null}}),
  })))
  return result
}
