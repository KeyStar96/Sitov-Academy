jest.mock('server-only',()=>({}),{virtual:true})
jest.mock('next/cache',()=>({revalidatePath:jest.fn()}))
jest.mock('@/utils/supabase/server',()=>({createClient:jest.fn()}))
jest.mock('@/lib/profile-person',()=>({resolveVerifiedPerson:jest.fn()}))
import type {User} from '@supabase/supabase-js'
import {loadProfileMonthlyState} from '@/lib/profile-dashboard-server'
import {createClient} from '@/utils/supabase/server'
import {resolveVerifiedPerson} from '@/lib/profile-person'
import {profileMonthWindow} from '@/lib/profile-month'
const month=profileMonthWindow()
const user={id:'verified-user',email:'verified@example.invalid',email_confirmed_at:'2026-01-01'} as User
const booking=(ids=['course-uuid'],status='pending',target=month.next)=>({id:'booking',target_month:target,booking_items:ids.map(course_id=>({course_id,requested_units:null})),status,revision:2})
function client(rows:ReturnType<typeof booking>[]=[],error:{code:string}|null=null){
 const catalog={select:jest.fn().mockReturnThis(),is:jest.fn().mockReturnThis(),order:jest.fn().mockResolvedValue({data:[{id:'course-uuid',title:'Test',slug:'test',course_translations:[],unit_price:25,unit_minutes:45,category:'private',type:'online',start_date:null,end_date:null},{id:'ended-uuid',title:'Old',slug:'old',course_translations:[],unit_price:25,unit_minutes:45,category:'private',type:'online',start_date:null,end_date:'2000-01-01'}],error})}
 const bookings={select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),neq:jest.fn().mockReturnThis(),order:jest.fn().mockResolvedValue({data:rows,error:null})}
 return {from:jest.fn((table:string)=>table==='courses'?catalog:bookings)} as unknown as Awaited<ReturnType<typeof createClient>>
}
beforeEach(()=>{jest.clearAllMocks();jest.mocked(resolveVerifiedPerson).mockResolvedValue({id:'trusted-person',unresolved:false})})
it('uses canonical UUID selections and a server revision',async()=>{
 const result=await loadProfileMonthlyState(client([booking(),booking(['ended-uuid'],'confirmed',month.current)]),user)
 expect(result.source).toBe('booking');expect(result.selection.courseSelections).toEqual([{courseId:'course-uuid'}]);expect(result.booking?.revision).toBe(2)
 expect(resolveVerifiedPerson).toHaveBeenCalledWith(user)
})
it('retains an explicit pause instead of inheriting courses',async()=>{
 const result=await loadProfileMonthlyState(client([booking([],'cancelled'),booking(['course-uuid'],'confirmed',month.current)]),user)
 expect(result.selection).toEqual({courseSelections:[],paused:true})
})
it('inherits confirmed courses and filters ended courses',async()=>{
 const result=await loadProfileMonthlyState(client([booking(['course-uuid','ended-uuid'],'confirmed',month.current)]),user)
 expect(result.source).toBe('previous');expect(result.selection.courseSelections).toEqual([{courseId:'course-uuid'}])
})
it('inherits the explicitly requested private lesson quantity without recomputing it as zero',async()=>{
 const previous={...booking(['course-uuid'],'confirmed',month.current),booking_items:[{course_id:'course-uuid',requested_units:7}]}
 const result=await loadProfileMonthlyState(client([previous]),user)
 expect(result.selection.courseSelections).toEqual([{courseId:'course-uuid',requestedUnits:7}])
 expect(result.courses[0]).toMatchObject({unitPrice:25,unitMinutes:45,category:'private'})
})
it('does not disguise a database outage as an empty selection',async()=>{
 await expect(loadProfileMonthlyState(client([],{code:'42P01'}),user)).rejects.toThrow('request_failed')
})
it('does not query bookings for an ambiguous unlinked identity',async()=>{
 jest.mocked(resolveVerifiedPerson).mockResolvedValue({id:null,unresolved:true});const db=client()
 const result=await loadProfileMonthlyState(db,user)
 expect(result.source).toBe('unresolved');expect(result.selection.courseSelections).toEqual([]);expect(db.from).not.toHaveBeenCalledWith('bookings')
})
