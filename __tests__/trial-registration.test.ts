import {submitTrialLesson} from '@/app/actions/submit-trial'
import {trialEligibilityHint} from '@/app/actions/trialEligibilityHint'
import {createAdminClient} from '@/utils/supabase/admin'
import {rateLimit} from '@/lib/ratelimit'
jest.mock('server-only',()=>({}),{virtual:true})
jest.mock('@/utils/supabase/admin',()=>({createAdminClient:jest.fn()}))
jest.mock('@/lib/ratelimit',()=>({rateLimit:jest.fn()}))
jest.mock('next/headers',()=>({headers:async()=>({get:()=>null})}))
const id='00000000-0000-4000-8000-000000000001',rpc=jest.fn(),lookup=jest.fn()
const query={select:jest.fn().mockReturnThis(),in:jest.fn().mockReturnThis(),is:lookup},from=jest.fn(()=>query)
const course=(type='presence',category='german')=>({id,type,category,archived_at:null})
const input={firstName:'Anna',lastName:'Test',email:'anna@example.test',courseId:id,trialDate:'2026-10-05',privacyAccepted:true,agbAccepted:true,locale:'uk'}
beforeEach(()=>{jest.clearAllMocks();jest.mocked(rateLimit).mockResolvedValue({success:true,limit:3,remaining:2,reset:0});rpc.mockResolvedValue({data:id,error:null});lookup.mockResolvedValue({data:[course()],error:null});jest.mocked(createAdminClient).mockReturnValue({rpc,from} as unknown as ReturnType<typeof createAdminClient>)})
 it('does not expose existing pupils through public eligibility probes',async()=>{
  expect(await trialEligibilityHint('victim@example.test','Anna','Test')).toEqual({eligible:true});expect(createAdminClient).not.toHaveBeenCalled()
 })
it('stores trials through the atomic business RPC with explicit consents',async()=>{
 expect(await submitTrialLesson(input)).toEqual({success:true,message:'trial_success'})
 expect(rpc).toHaveBeenCalledWith('submit_business_registration',expect.objectContaining({p_course_selections:[{course_id:id}],p_start:'2026-10-05',p_trial:true,p_locale:'uk',p_consents:{privacy:true,agb:true,recording:null}}))
})
it.each(['german','speaking','online'])('requires true for an actual online %s group trial even if the browser claims an exception',async category=>{
 lookup.mockResolvedValue({data:[course('online',category)],error:null})
 for(const videoRecordingAccepted of [false,undefined])expect(await submitTrialLesson({...input,videoRecordingAccepted,courseType:'presence',category:'private'})).toEqual({success:false,message:'generic_error'})
 expect(rpc).not.toHaveBeenCalled()
 expect(await submitTrialLesson({...input,videoRecordingAccepted:true})).toEqual({success:true,message:'trial_success'})
 expect(from).toHaveBeenCalledWith('courses');expect(query.select).toHaveBeenCalledWith('id,type,category,archived_at');expect(query.in).toHaveBeenCalledWith('id',[id])
 expect(rpc).toHaveBeenCalledWith('submit_business_registration',expect.objectContaining({p_consents:{privacy:true,agb:true,recording:true}}))
})
it.each([['online','private'],...['german','speaking','online','private'].map(category=>['presence',category])])('does not impose recording on %s/%s exceptions',async(type,category)=>{
 lookup.mockResolvedValue({data:[course(type,category)],error:null})
 for(const videoRecordingAccepted of [false,true,undefined]){
  expect(await submitTrialLesson({...input,videoRecordingAccepted})).toEqual({success:true,message:'trial_success'})
  expect(rpc).toHaveBeenLastCalledWith('submit_business_registration',expect.objectContaining({p_consents:{privacy:true,agb:true,recording:videoRecordingAccepted??null}}))
 }
})
it.each([
 {data:null,error:{message:'Private lookup error'}},{data:[],error:null},
 {data:[{...course(),id:'00000000-0000-4000-8000-000000000002'}],error:null},
 {data:[course(),course()],error:null},{data:[{...course(),archived_at:'2026-10-04T10:00:00Z'}],error:null},
 {data:[course('unknown','private')],error:null},{data:[course('online','unknown')],error:null},
])('does not book on an unavailable or invalid persisted trial course: %#',async result=>{
 lookup.mockResolvedValue(result)
 expect(await submitTrialLesson({...input,videoRecordingAccepted:true})).toEqual({success:false,message:'generic_error'})
 expect(rpc).not.toHaveBeenCalled()
})
it('rejects missing consents and legacy course IDs before database access',async()=>{
 expect((await submitTrialLesson({...input,privacyAccepted:false})).success).toBe(false)
 expect((await submitTrialLesson({...input,agbAccepted:false,videoRecordingAccepted:true})).success).toBe(false)
 expect((await submitTrialLesson({...input,courseId:'legacy-course'})).success).toBe(false);expect(createAdminClient).not.toHaveBeenCalled()
})
it('maps the atomic duplicate-trial constraint without leaking the existing record',async()=>{
 rpc.mockResolvedValue({data:null,error:{code:'23505',message:'Private record'}})
 expect(await submitTrialLesson(input)).toEqual({success:false,message:'trial_already_used'})
})
it.each([
 ['conflict','23505','trial_already_used'],
 ['invalid_input','23514','generic_error'],
])('does not acknowledge JSON trial errors: %s',async(error,sqlstate,message)=>{
 rpc.mockResolvedValue({data:{error,message:'The request could not be completed.',sqlstate},error:null})
 expect(await submitTrialLesson(input)).toEqual({success:false,message})
})
it('blocks rate-limited requests and catches storage failures',async()=>{
 jest.mocked(rateLimit).mockResolvedValueOnce({success:false,limit:3,remaining:0,reset:0})
 expect((await submitTrialLesson(input)).success).toBe(false);expect(createAdminClient).not.toHaveBeenCalled()
 rpc.mockRejectedValueOnce(new Error('Private error'));expect(await submitTrialLesson(input)).toEqual({success:false,message:'generic_error'})
})
