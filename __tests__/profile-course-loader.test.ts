jest.mock('server-only',()=>({}),{virtual:true})
jest.mock('next/cache',()=>({revalidatePath:jest.fn()}))
jest.mock('@/utils/supabase/admin',()=>({createAdminClient:jest.fn()}))
jest.mock('@/utils/supabase/server',()=>({createClient:jest.fn()}))
jest.mock('@/lib/profile-legacy',()=>({resolveLegacyProfile:jest.fn()}))
import type { User } from '@supabase/supabase-js'
import { loadProfileMonthlyState } from '@/lib/profile-dashboard-server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { resolveLegacyProfile } from '@/lib/profile-legacy'
import { profileMonthWindow } from '@/lib/profile-month'
import type { Tables } from '@/supabase/database.types'
const month=profileMonthWindow()
const user={id:'verified-user',email:'verified@example.invalid',email_confirmed_at:'2026-01-01'} as User
const booking=(ids=['course-uuid'],status='pending'):Tables<'monthly_course_bookings'>=>({id:'booking',user_id:user.id,target_month:month.next,course_ids:ids,status})
function client(next:Tables<'monthly_course_bookings'>|null=null, previous:Tables<'monthly_course_bookings'>|null=null, error:{code:string}|null=null){
  const catalog={select:jest.fn().mockReturnThis(),order:jest.fn().mockResolvedValue({data:[{id:'legacy-text',booking_id:'course-uuid',title:'Test',translation_key:'test',type:'online',start_date:null,end_date:null},{id:'ended',booking_id:'ended-uuid',title:'Old',translation_key:'old',type:'online',start_date:null,end_date:'2000-01-01'}],error})}
  const bookings={select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),lt:jest.fn().mockReturnThis(),order:jest.fn().mockReturnThis(),limit:jest.fn().mockReturnThis(),maybeSingle:jest.fn().mockResolvedValueOnce({data:next,error:null}).mockResolvedValueOnce({data:previous,error:null})}
  const db={from:jest.fn((table:string)=>table==='courses'?catalog:bookings)}
  return db as unknown as Awaited<ReturnType<typeof createClient>>
}
beforeEach(()=>jest.clearAllMocks())
it('prefers saved next-month booking over inherited courses',async()=>{
  const result=await loadProfileMonthlyState(client(booking(),booking(['ended-uuid'])),user)
  expect(result.source).toBe('booking');expect(result.selection.courseIds).toEqual(['course-uuid'])
  expect(resolveLegacyProfile).not.toHaveBeenCalled()
})
it('retains empty cancellation instead of falling back to previous courses',async()=>{
  const result=await loadProfileMonthlyState(client(booking([],'cancelled'),booking()),user)
  expect(result.selection).toEqual({courseIds:[],paused:true})
})
it('inherits the last monthly selection and filters courses that have ended',async()=>{
  const result=await loadProfileMonthlyState(client(null,booking(['course-uuid','ended-uuid'])),user)
  expect(result.source).toBe('previous');expect(result.selection.courseIds).toEqual(['course-uuid'])
})
it('does not turn a database outage into an empty course selection',async()=>{
  await expect(loadProfileMonthlyState(client(null,null,{code:'42P01'}),user)).rejects.toThrow('request_failed')
})
it('does not read relatives enrollments for an ambiguous identity',async()=>{
  jest.mocked(resolveLegacyProfile).mockResolvedValue({id:null,unresolved:true})
  const result=await loadProfileMonthlyState(client(),user)
  expect(result.source).toBe('unresolved');expect(result.selection.courseIds).toEqual([])
  expect(createAdminClient).not.toHaveBeenCalled()
})
it('maps confirmed current enrollments from text IDs to booking UUIDs',async()=>{
  jest.mocked(resolveLegacyProfile).mockResolvedValue({id:'trusted-person',unresolved:false})
  const registrations={select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),or:jest.fn().mockResolvedValue({data:[{id:'registration'}],error:null})}
  const enrollments={select:jest.fn().mockReturnThis(),in:jest.fn().mockResolvedValue({data:[{course_id:'legacy-text'}],error:null})}
  jest.mocked(createAdminClient).mockReturnValue({from:jest.fn((table:string)=>table==='registrations'?registrations:enrollments)} as unknown as ReturnType<typeof createAdminClient>)
  const result=await loadProfileMonthlyState(client(),user)
  expect(result.source).toBe('enrollments');expect(result.selection.courseIds).toEqual(['course-uuid'])
  expect(registrations.eq).toHaveBeenCalledWith('user_id','trusted-person')
  expect(registrations.eq).toHaveBeenCalledWith('status','confirmed')
})
