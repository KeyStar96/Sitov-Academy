import 'server-only'
import {createClient} from '@/utils/supabase/server'
import {checkDatabaseError} from '@/lib/actions/backend'
import {profileMonthWindow} from '@/lib/profile-month'
import {toTeacherNote,type TeacherStudentNote} from '@/lib/types/teacher-notes'
import type {NextMonthOverview} from '@/lib/types/admin-staff'
import {buildNextMonthOverview,notesByStudent} from '@/lib/admin-next-month'
import {monthlyBooking} from './business-bookings'
export async function loadStaffBlackboardNotes():Promise<Record<string,TeacherStudentNote>> {
 const client=await createClient();const {data,error}=await client.from('teacher_student_notes').select('*').order('id');checkDatabaseError(error);return notesByStudent((data??[]).map(toTeacherNote))
}
export async function loadNextMonthStaffOverview():Promise<NextMonthOverview> {
 const client=await createClient(),months=profileMonthWindow()
 const [profiles,bookings,courses,notes]=await Promise.all([
  client.from('profile_details').select('*').eq('role','student'),
  client.from('bookings').select('*,people(auth_user_id),booking_items(course_id)').neq('kind','trial').neq('status','rejected').order('target_month'),
  client.from('courses').select('*').is('archived_at',null).order('sort_order'),loadStaffBlackboardNotes(),
 ])
 for(const response of [profiles,bookings,courses])checkDatabaseError(response.error)
 return buildNextMonthOverview({targetMonth:months.next,afterNext:months.afterNext,
 students:(profiles.data??[]).filter(p=>!!p.id).map(p=>({id:p.id!,name:p.name,email:p.email??'',phone:p.phone,street:p.street,zip_code:p.zip_code,city:p.city})),
 bookings:(bookings.data??[]).filter(b=>!!b.people?.auth_user_id).map(b=>monthlyBooking(b,b.people!.auth_user_id!)),
 catalog:(courses.data??[]).map(c=>({bookingId:c.id,title:c.title,translationKey:c.translation_key,type:c.type==='online'?'online':'presence',startDate:c.start_date,endDate:c.end_date})),notes})
}
