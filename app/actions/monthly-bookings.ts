'use server'
import {BackendError,checkDatabaseError,checkRpcError,revalidateBackendPages,withBackendSession} from '@/lib/actions/backend'
import {uuidSchema} from '@/lib/types/backend'
import type {BackendActionResult} from '@/lib/types/backend'
import {saveNextMonthSchema,type MonthlyCourseBooking,type ProfileMonthlyState} from '@/lib/types/monthly-bookings'
import {loadProfileMonthlyState} from '@/lib/profile-dashboard-server'
import {courseSelectionsForRpc} from '@/lib/course-selection'
import {monthlyBooking} from '@/lib/business-bookings'
export async function getProfileMonthlyState():Promise<BackendActionResult<ProfileMonthlyState>> {
 return withBackendSession(({supabase,user})=>loadProfileMonthlyState(supabase,user))
}
export async function saveNextMonthBooking(input:unknown):Promise<BackendActionResult<MonthlyCourseBooking>> {
 return withBackendSession(async({supabase,userId})=>{
  const fields=saveNextMonthSchema.parse(input)
  const {data:id,error}=await supabase.rpc('save_business_month',{p_month:fields.targetMonth,p_course_selections:courseSelectionsForRpc(fields.courseSelections),p_paused:fields.paused,p_expected:fields.expected?.id??undefined,p_revision:fields.expected?.revision??undefined})
  checkDatabaseError(error)
  checkRpcError(id)
  if(!id)throw new BackendError('not_found')
  const result=await supabase.from('bookings').select('*,booking_items(course_id,requested_units)').eq('id',uuidSchema.parse(id)).single()
  checkDatabaseError(result.error)
  if(!result.data)throw new BackendError('not_found')
  revalidateBackendPages();return monthlyBooking(result.data,userId)
 })
}
