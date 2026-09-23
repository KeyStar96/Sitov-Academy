import 'server-only'
import {createClient} from '@/utils/supabase/server'
import {checkDatabaseError} from '@/lib/actions/backend'
import {resolveVerifiedPerson} from '@/lib/profile-person'
import {profileMonthWindow} from '@/lib/profile-month'
import type {ProfileMonthlyState} from '@/lib/types/monthly-bookings'
import {monthlyBooking} from './business-bookings'
import type {User} from '@supabase/supabase-js'
import {courseSessionsInMonth} from '@/lib/profile-month'
export async function loadProfileMonthlyState(supabase:Awaited<ReturnType<typeof createClient>>,user:User):Promise<ProfileMonthlyState> {
 const person=await resolveVerifiedPerson(user)
 const months=profileMonthWindow()
 const [catalog,bookings]=await Promise.all([
  supabase.from('courses').select('*,course_translations(*),course_schedules(weekday)').is('archived_at',null).order('sort_order'),
  person.id?supabase.from('bookings').select('*,booking_items(course_id,requested_units)').eq('person_id',person.id).neq('kind','trial').neq('status','rejected').order('target_month',{ascending:false}):Promise.resolve({data:[],error:null}),
 ])
 checkDatabaseError(catalog.error);checkDatabaseError(bookings.error)
 const courses=(catalog.data??[]).map(course=>({id:course.id,title:course.title,slug:course.slug,translations:course.course_translations,category:course.category,unitPrice:course.unit_price,unitMinutes:course.unit_minutes,type:course.type==='online'?'online' as const:'presence' as const,
 available:(!course.start_date||course.start_date<months.afterNext)&&(!course.end_date||course.end_date>=months.next),
 sessions:courseSessionsInMonth(course.course_schedules??[],months.next,course.start_date,course.end_date)}))
 const all=(bookings.data??[]).map(row=>monthlyBooking(row,user.id))
 const next=all.find(row=>row.targetMonth===months.next)??null
 const previous=all.find(row=>row.targetMonth<months.next)??null
 const selected=next??previous
 return {targetMonth:months.next,booking:next,courses,source:person.unresolved?'unresolved':next?'booking':previous?'previous':'empty',
 selection:{courseSelections:(selected?.courseSelections??[]).filter(selection=>courses.some(course=>course.id===selection.courseId&&(next||course.available))),paused:selected?.status==='cancelled'}}
}
