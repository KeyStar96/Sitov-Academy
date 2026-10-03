jest.mock('server-only',()=>({}),{virtual:true})
const mockRemove=jest.fn()
const mockBucket=jest.fn(()=>({remove:mockRemove}))
jest.mock('@/utils/supabase/admin',()=>({createAdminClient:jest.fn(()=>({storage:{from:mockBucket}}))}))
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/supabase/database.types'
import { performLearningReset } from '@/lib/reset-user-progress'
import { runConfirmedDelete } from '@/lib/confirmed-delete'
const token='11111111-1111-4111-8111-111111111111'
const ok=(data:unknown)=>({data,error:null})
const exam={bucket_id:'sitov-exam-submissions',object_name:`${token}/photo/photo.jpg`}
const pronunciation={bucket_id:'pronunciation_audio',object_name:`${token}/voice.wav`}
function backend(data:unknown[]){const rpc=jest.fn(),remove=jest.fn().mockResolvedValue(ok([])),from=jest.fn(()=>({remove}));for(const value of data)rpc.mockResolvedValueOnce(ok(value));return {client:{rpc,storage:{from}} as unknown as SupabaseClient<Database>,rpc,remove,from}}
beforeEach(()=>{jest.clearAllMocks();mockRemove.mockResolvedValue(ok([]));jest.spyOn(console,'error').mockImplementation(()=>{})})
afterEach(()=>jest.restoreAllMocks())
it('groups a mixed persistent reset manifest by exact private bucket before atomic finalization',async()=>{
 const b=backend([token,[exam,pronunciation],[],true])
 expect(await performLearningReset(b.client)).toEqual({success:true})
 expect(b.from.mock.calls).toEqual([['sitov-exam-submissions'],['pronunciation_audio']])
 expect(b.remove.mock.calls).toEqual([[[exam.object_name]],[[pronunciation.object_name]]])
 expect(b.remove.mock.invocationCallOrder.at(-1)).toBeLessThan(b.rpc.mock.invocationCallOrder.at(-1)!)
 expect(b.rpc).toHaveBeenLastCalledWith('finish_learning_reset',{p_token:token})
})
it('a partial mixed-bucket failure never finalizes; retry resumes only files still in the manifest',async()=>{
 const b=backend([token,[exam,pronunciation]])
 b.remove.mockResolvedValueOnce(ok([])).mockResolvedValueOnce({data:null,error:{message:'Offline'}})
 expect(await performLearningReset(b.client)).toEqual({success:false,reason:'reset_failed'})
 expect(b.rpc).not.toHaveBeenCalledWith('finish_learning_reset',expect.anything())
 const resumed=backend([token,[pronunciation],[],true])
 expect(await performLearningReset(resumed.client)).toEqual({success:true})
 expect(resumed.from.mock.calls).toEqual([['pronunciation_audio']])
})
it('account deletion drains exam files and legacy pronunciation replies through the same retry loop',async()=>{
 const call=jest.fn().mockResolvedValueOnce(ok({success:true,deleted:false,pendingFiles:[exam]})).mockResolvedValueOnce(ok({success:true,deleted:false,pendingAudio:[pronunciation.object_name]})).mockResolvedValueOnce(ok({success:true,deleted:true}))
 expect(await runConfirmedDelete(call)).toEqual({success:true})
 expect(mockBucket.mock.calls).toEqual([['sitov-exam-submissions'],['pronunciation_audio']])
 expect(mockRemove.mock.calls).toEqual([[[exam.object_name]],[[pronunciation.object_name]]])
 expect(call).toHaveBeenCalledTimes(3)
})
it('account deletion accepts a mixed file manifest but never deletes shared production assets',async()=>{
 const call=jest.fn().mockResolvedValueOnce(ok({success:true,deleted:false,pendingFiles:[exam,pronunciation]})).mockResolvedValueOnce(ok({success:true,deleted:true}))
 expect(await runConfirmedDelete(call)).toEqual({success:true})
 expect(mockBucket.mock.calls).toEqual([['sitov-exam-submissions'],['pronunciation_audio']])
 mockBucket.mockClear();mockRemove.mockClear()
 for(const bucket_id of ['sitov-exam-productions','audio_cache','course-assets']){
  expect(await runConfirmedDelete(jest.fn().mockResolvedValue(ok({success:true,deleted:false,pendingFiles:[{bucket_id,object_name:'shared.wav'}]})))).toEqual({success:false,reason:'delete_failed'})
 }
 expect(mockRemove).not.toHaveBeenCalled()
})
it('repeated file manifests or failed Storage deletion retain the account for explicit retry',async()=>{
 const pending=ok({success:true,deleted:false,pendingFiles:[exam]})
 const call=jest.fn().mockResolvedValue(pending)
 expect(await runConfirmedDelete(call)).toEqual({success:false,reason:'delete_failed'});expect(call).toHaveBeenCalledTimes(2);expect(mockRemove).toHaveBeenCalledTimes(1)
 mockRemove.mockClear();mockRemove.mockResolvedValueOnce({data:null,error:{message:'offline'}})
 const failed=jest.fn().mockResolvedValue(pending)
 expect(await runConfirmedDelete(failed)).toEqual({success:false,reason:'delete_failed'});expect(failed).toHaveBeenCalledTimes(1)
})
