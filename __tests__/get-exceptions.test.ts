jest.mock('server-only',()=>({}),{virtual:true})
jest.mock('next/cache',()=>({unstable_cache:(read:unknown)=>read}))
jest.mock('@supabase/supabase-js',()=>({createClient:jest.fn()}))
jest.mock('@/lib/supabase-env',()=>({readSupabaseServerConfig:()=>({url:'https://example.test',anonKey:'public-test-key'})}))

import { createClient } from '@supabase/supabase-js'
import { getExceptions } from '@/app/actions/get-exceptions'
import { calculateMonthlyStats } from '@/lib/course-calculations'

it('includes cancellations beyond the first database page in displayed monthly prices',async()=>{
 const query={select:jest.fn().mockReturnThis(),order:jest.fn().mockReturnThis(),range:jest.fn()
  .mockResolvedValueOnce({data:Array.from({length:500},(_,index)=>({id:`earlier-${index}`,course_id:'other-course',date:'2026-10-01',reason:'Other course'})),error:null})
  .mockResolvedValueOnce({data:[{id:'late',course_id:'thursday-course',date:'2026-10-08',reason:'Kursausfall'},{id:'global',course_id:null,date:'2026-10-15',reason:'Ferien'}],error:null})}
 jest.mocked(createClient).mockReturnValue({from:jest.fn(()=>query)} as unknown as ReturnType<typeof createClient>)
 const exceptions=await getExceptions()
 expect(query.range).toHaveBeenNthCalledWith(1,0,499)
 expect(query.range).toHaveBeenNthCalledWith(2,500,999)
 const stats=calculateMonthlyStats({id:'thursday-course',slug:'thursday',type:'online',unitPrice:10,unitMinutes:45,sessions:[{day:'Do',startTime:'19:00',endTime:'20:30'}]},'de',9,2026,exceptions)
 expect(stats.sessionCount).toBe(3)
 expect(stats.totalUnits*10).toBe(60)
 expect(stats.deductions).toHaveLength(2)
})

it('does not display a full-price month when the cancellation calendar could not be loaded',async()=>{
 const query={select:jest.fn().mockReturnThis(),order:jest.fn().mockReturnThis(),range:jest.fn().mockResolvedValue({data:null,error:{code:'unavailable'}})}
 jest.mocked(createClient).mockReturnValue({from:jest.fn(()=>query)} as unknown as ReturnType<typeof createClient>)
 const log=jest.spyOn(console,'error').mockImplementation(()=>{})
 try { await expect(getExceptions()).rejects.toThrow('course_calendar_unavailable') }
 finally { log.mockRestore() }
})
