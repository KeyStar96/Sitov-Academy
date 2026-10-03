import 'server-only'
import {createClient} from '@/utils/supabase/server'
import {checkDatabaseError} from '@/lib/actions/backend'
import {resolveVerifiedPerson} from '@/lib/profile-person'
import {profileMonthWindow} from '@/lib/profile-month'
import type {ProfileMonthlyState} from '@/lib/types/monthly-bookings'
import {monthlyBooking} from './business-bookings'
import type {User} from '@supabase/supabase-js'
import {hasConfirmedCourseRegistration} from '@/lib/profile-monthly-access'
import {profileMonthlyQuote} from '@/lib/profile-monthly-quote'
import {readAllRows} from '@/lib/supabase-read'
export async function loadProfileMonthlyState(supabase:Awaited<ReturnType<typeof createClient>>,user:User):Promise<ProfileMonthlyState> {
 const person=await resolveVerifiedPerson(user)
 const months=profileMonthWindow()
 const [catalog,bookings,hasConfirmedRegistration,exceptions]=await Promise.all([
  supabase.from('courses').select('*,course_translations(*),course_schedules(weekday,start_time,end_time)').is('archived_at',null).order('sort_order'),
  person.id?supabase.from('bookings').select('*,booking_items(course_id,requested_units)').eq('person_id',person.id).neq('kind','trial').neq('status','rejected').order('target_month',{ascending:false}):Promise.resolve({data:[],error:null}),
  person.id&&!person.unresolved?hasConfirmedCourseRegistration(supabase,person.id):Promise.resolve(false),
  readAllRows(async(from,to)=>{
   const result=await supabase.from('course_exceptions').select('course_id,date').gte('date',months.next).lt('date',months.afterNext).order('id').range(from,to)
   checkDatabaseError(result.error);return result
  }),
 ])
 checkDatabaseError(catalog.error);checkDatabaseError(bookings.error)
 const courses=(catalog.data??[]).map(course=>({id:course.id,title:course.title,slug:course.slug,translations:course.course_translations,category:course.category,unitPrice:course.unit_price,unitMinutes:course.unit_minutes,type:course.type==='online'?'online' as const:'presence' as const,
 available:(!course.start_date||course.start_date<months.afterNext)&&(!course.end_date||course.end_date>=months.next),
 ...profileMonthlyQuote(course,months.next,exceptions)}))
 const all=(bookings.data??[]).map(row=>monthlyBooking(row,user.id))
 const next=all.find(row=>row.targetMonth===months.next)??null
 const previous=all.find(row=>row.targetMonth<months.next)??null
 const selected=next??previous
 return {hasConfirmedRegistration,targetMonth:months.next,booking:next,courses,source:person.unresolved?'unresolved':next?'booking':previous?'previous':'empty',
 selection:{courseSelections:(selected?.courseSelections??[]).filter(selection=>courses.some(course=>course.id===selection.courseId&&(next||course.available))),paused:selected?.status==='cancelled'}}
}
