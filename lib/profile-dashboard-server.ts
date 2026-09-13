import 'server-only'
import {createClient} from '@/utils/supabase/server'
import {checkDatabaseError} from '@/lib/actions/backend'
import {resolveLegacyProfile} from '@/lib/profile-legacy'
import {profileMonthWindow} from '@/lib/profile-month'
import type {ProfileMonthlyState} from '@/lib/types/monthly-bookings'
import {monthlyBooking} from './business-bookings'
import type {User} from '@supabase/supabase-js'
export async function loadProfileMonthlyState(supabase:Awaited<ReturnType<typeof createClient>>,user:User):Promise<ProfileMonthlyState> {
 const person=await resolveLegacyProfile(user)
 const months=profileMonthWindow()
 const [catalog,bookings]=await Promise.all([
  supabase.from('courses').select('*').is('archived_at',null).order('sort_order'),
  person.id?supabase.from('bookings').select('*,booking_items(course_id)').eq('person_id',person.id).neq('kind','trial').neq('status','rejected').order('target_month',{ascending:false}):Promise.resolve({data:[],error:null}),
 ])
 checkDatabaseError(catalog.error);checkDatabaseError(bookings.error)
 const courses=(catalog.data??[]).map(course=>({id:course.id,title:course.title,translationKey:course.translation_key,type:course.type==='online'?'online' as const:'presence' as const,
 available:(!course.start_date||course.start_date<months.afterNext)&&(!course.end_date||course.end_date>=months.next)}))
 const all=(bookings.data??[]).map(row=>monthlyBooking(row,user.id))
 const next=all.find(row=>row.target_month===months.next)??null
 const previous=all.find(row=>row.target_month<months.next)??null
 const selected=next??previous
 return {targetMonth:months.next,booking:next,courses,source:person.unresolved?'unresolved':next?'booking':previous?'previous':'empty',
 selection:{courseIds:(selected?.course_ids??[]).filter(id=>courses.some(course=>course.id===id&&(next||course.available))),paused:selected?.status==='cancelled'}}
}
