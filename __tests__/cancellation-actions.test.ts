/** @jest-environment node */
import {submitCancellation} from '@/app/actions/submit-cancellation'
const mockRpc=jest.fn()
jest.mock('@/utils/supabase/admin',()=>({createAdminClient:()=>({rpc:mockRpc})}))
jest.mock('next/headers',()=>({headers:async()=>new Headers({'x-forwarded-for':'127.0.0.1'})}))
jest.mock('@/lib/ratelimit',()=>({rateLimit:async()=>({success:true})}))
const courseId='00000000-0000-4000-8000-000000000020'
const input={fullName:'Test Learner',email:'test@example.test',courseId,terminationDate:'asap' as const}
beforeEach(()=>{jest.clearAllMocks();mockRpc.mockResolvedValue({data:{id:courseId},error:null})})
it('submits the selected course identity instead of a copied course title',async()=>{
 expect(await submitCancellation(input,'uk')).toEqual({success:true})
 expect(mockRpc).toHaveBeenCalledWith('submit_business_cancellation',expect.objectContaining({p_course_id:courseId,p_locale:'uk'}))
 expect(mockRpc.mock.calls[0][1]).not.toHaveProperty('p_course')
})
it('permits a cancellation without a particular course',async()=>{
 expect(await submitCancellation({...input,courseId:''},'de')).toEqual({success:true})
 expect(mockRpc.mock.calls[0][1].p_course_id).toBeUndefined()
})
it('does not report a structured database rejection as a successful cancellation',async()=>{
 mockRpc.mockResolvedValue({data:{error:'course_not_found',message:'Course missing.'},error:null})
 expect(await submitCancellation(input,'de')).toEqual({success:false,message:'generic_error'})
})
it('rejects free-text course input before calling the database',async()=>{
 const log=jest.spyOn(console,'error').mockImplementation(()=>{})
 try{expect(await submitCancellation({...input,courseId:'Deutsch'},'de')).toEqual({success:false,message:'generic_error'})}
 finally{log.mockRestore()}
 expect(mockRpc).not.toHaveBeenCalled()
})
