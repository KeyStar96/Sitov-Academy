import {submitEnrollment} from '@/app/actions/submit-enrollment'
import {getCourses} from '@/app/actions/get-courses'
import {createAdminClient} from '@/utils/supabase/admin'
import {rateLimit} from '@/lib/ratelimit'
const mockCatalog={from:jest.fn()}
jest.mock('@supabase/supabase-js',()=>({createClient:jest.fn(()=>mockCatalog)}))
jest.mock('@/lib/supabase-env',()=>({readSupabaseServerConfig:()=>({url:'http://127.0.0.1:8000',anonKey:'isolated-mock'})}))
jest.mock('next/cache',()=>({unstable_cache:<T,>(fn:T)=>fn}))
jest.mock('@/utils/supabase/admin',()=>({createAdminClient:jest.fn()}))
jest.mock('@/lib/ratelimit',()=>({rateLimit:jest.fn()}))
jest.mock('next/headers',()=>({headers:async()=>({get:()=>null})}))
const id='00000000-0000-4000-8000-000000000001'
const form={personal:{firstName:'Anna',lastName:'Test',email:' ANNA@example.test ',birthDate:'01.01.1980',street:'Teststraße 1',zip:'30165',city:'Hannover',phone:''}}
const consents={privacy:true,agb:true,revocation:false}
const rpc=jest.fn()
beforeEach(()=>{jest.clearAllMocks();jest.mocked(rateLimit).mockResolvedValue({success:true,limit:3,remaining:2,reset:0});jest.mocked(createAdminClient).mockReturnValue({rpc} as unknown as ReturnType<typeof createAdminClient>);rpc.mockResolvedValue({data:id,error:null})})
it('saves registration in one RPC and never trusts browser totals or prices',async()=>{
 expect(await submitEnrollment(form,[{courseId:id,requestedUnits:3}],'01.10.2026',consents,'uk')).toEqual({success:true,message:'registration_success'})
 expect(rpc).toHaveBeenCalledWith('submit_business_registration',{p_contact:{name:'Anna Test',email:'anna@example.test',birth_date:'1980-01-01',phone:null,street:'Teststraße 1',postal_code:'30165',city:'Hannover'},p_course_selections:[{course_id:id,requested_units:3}],p_start:'2026-10-01',p_consents:{privacy:true,agb:true,revocation:false,recording:null},p_locale:'uk',p_trial:false})
})
it('validates UUID course selections, dates and consent before accessing storage',async()=>{
 for(const [ids,start,legal] of [[[id,id],'01.10.2026',consents],[['legacy-text-id'],'01.10.2026',consents],[[id],'31.02.2026',consents],[[id],'01.10.2026',{...consents,privacy:false}]] as const){expect((await submitEnrollment(form,ids.map(courseId=>({courseId})),start,legal)).success).toBe(false)}
 expect(createAdminClient).not.toHaveBeenCalled()
})
it('rate limits before creating privileged clients',async()=>{
 jest.mocked(rateLimit).mockResolvedValue({success:false,limit:3,remaining:0,reset:0})
 expect((await submitEnrollment(form,[{courseId:id}],'01.10.2026',consents)).success).toBe(false);expect(createAdminClient).not.toHaveBeenCalled()
})
it('hides database errors without falsely acknowledging a registration',async()=>{
 rpc.mockResolvedValue({data:null,error:{code:'23505',message:'Private identity'}})
 expect(await submitEnrollment(form,[{courseId:id}],'01.10.2026',consents)).toEqual({success:false,message:'generic_error'})
})
it('does not acknowledge an HTTP-successful JSON registration error',async()=>{
 rpc.mockResolvedValue({data:{error:'invalid_input',message:'The request contains invalid data.',sqlstate:'23514'},error:null})
 expect(await submitEnrollment(form,[{courseId:id}],'01.10.2026',consents)).toEqual({success:false,message:'generic_error'})
})
it('maps relational schedules and database translations for previously unknown courses',async()=>{
 const chain={select:jest.fn().mockReturnThis(),is:jest.fn().mockReturnThis(),order:jest.fn()};chain.order.mockReturnValueOnce(chain).mockResolvedValueOnce({error:null,data:[{id,slug:'new-c2',title:'Neuer C2-Kurs',description:'Individuell',type:'online',category:'speaking',unit_price:15,sort_order:125,level:'C2',unit_minutes:60,start_date:null,end_date:null,trial_lessons:false,course_translations:[{locale:'uk',title:'Новий курс',description:'Опис'}],course_schedules:[{weekday:6,start_time:'10:00:00',end_time:'11:00:00'}]}]});mockCatalog.from.mockReturnValue(chain)
 const result=await getCourses();expect(result[0]).toEqual(expect.objectContaining({id,title:'Neuer C2-Kurs',sortOrder:125,category:'speaking',translations:[{locale:'uk',title:'Новий курс',description:'Опис'}],sessions:[{day:'Sa',startTime:'10:00',endTime:'11:00'}]}))
})
it('displays a preserved marketing range without fabricating an authorization level',async()=>{
 const chain={select:jest.fn().mockReturnThis(),is:jest.fn().mockReturnThis(),order:jest.fn()}
 chain.order.mockReturnValueOnce(chain).mockResolvedValueOnce({error:null,data:[{id,slug:'wide',title:'All levels',description:'',type:'online',category:'private',unit_price:25,sort_order:1,level:null,audience_code:'A1-C2',unit_minutes:45,start_date:null,end_date:null,trial_lessons:false,course_translations:[],course_schedules:[]}]})
 mockCatalog.from.mockReturnValue(chain)
 expect((await getCourses())[0].level).toBe('A1-C2')
})
