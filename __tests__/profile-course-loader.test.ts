jest.mock('server-only',()=>({}),{virtual:true})
jest.mock('next/cache',()=>({revalidatePath:jest.fn()}))
jest.mock('@/utils/supabase/server',()=>({createClient:jest.fn()}))
jest.mock('@/lib/profile-legacy',()=>({resolveLegacyProfile:jest.fn()}))
import type {User} from '@supabase/supabase-js'
import {loadProfileMonthlyState} from '@/lib/profile-dashboard-server'
import {createClient} from '@/utils/supabase/server'
import {resolveLegacyProfile} from '@/lib/profile-legacy'
import {profileMonthWindow} from '@/lib/profile-month'
const month=profileMonthWindow()
const user={id:'verified-user',email:'verified@example.invalid',email_confirmed_at:'2026-01-01'} as User
const booking=(ids=['course-uuid'],status='pending',target=month.next)=>({id:'booking',target_month:target,booking_items:ids.map(course_id=>({course_id})),status,revision:2})
function client(rows:ReturnType<typeof booking>[]=[],error:{code:string}|null=null){
 const catalog={select:jest.fn().mockReturnThis(),is:jest.fn().mockReturnThis(),order:jest.fn().mockResolvedValue({data:[{id:'course-uuid',title:'Test',translation_key:'test',type:'online',start_date:null,end_date:null},{id:'ended-uuid',title:'Old',translation_key:'old',type:'online',start_date:null,end_date:'2000-01-01'}],error})}
 const bookings={select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),neq:jest.fn().mockReturnThis(),order:jest.fn().mockResolvedValue({data:rows,error:null})}
 return {from:jest.fn((table:string)=>table==='courses'?catalog:bookings)} as unknown as Awaited<ReturnType<typeof createClient>>
}
beforeEach(()=>{jest.clearAllMocks();jest.mocked(resolveLegacyProfile).mockResolvedValue({id:'trusted-person',unresolved:false})})
it('uses canonical UUID selections and a server revision',async()=>{
 const result=await loadProfileMonthlyState(client([booking(),booking(['ended-uuid'],'confirmed',month.current)]),user)
 expect(result.source).toBe('booking');expect(result.selection.courseIds).toEqual(['course-uuid']);expect(result.booking?.revision).toBe(2)
 expect(resolveLegacyProfile).toHaveBeenCalledWith(user)
})
it('retains an explicit pause instead of inheriting courses',async()=>{
 const result=await loadProfileMonthlyState(client([booking([],'cancelled'),booking(['course-uuid'],'confirmed',month.current)]),user)
 expect(result.selection).toEqual({courseIds:[],paused:true})
})
it('inherits confirmed courses and filters ended courses',async()=>{
 const result=await loadProfileMonthlyState(client([booking(['course-uuid','ended-uuid'],'confirmed',month.current)]),user)
 expect(result.source).toBe('previous');expect(result.selection.courseIds).toEqual(['course-uuid'])
})
it('does not disguise a database outage as an empty selection',async()=>{
 await expect(loadProfileMonthlyState(client([],{code:'42P01'}),user)).rejects.toThrow('request_failed')
})
it('does not query bookings for an ambiguous unlinked identity',async()=>{
 jest.mocked(resolveLegacyProfile).mockResolvedValue({id:null,unresolved:true});const db=client()
 const result=await loadProfileMonthlyState(db,user)
 expect(result.source).toBe('unresolved');expect(result.selection.courseIds).toEqual([]);expect(db.from).not.toHaveBeenCalledWith('bookings')
})
