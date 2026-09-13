import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/supabase/database.types'
import { performLearningReset } from '@/lib/reset-user-progress'
import { resetUserProgressSchema } from '@/lib/types/reset-progress'

const token='11111111-1111-4111-8111-111111111111'
const current={bucket_id:'pronunciation_audio',object_name:'owner/recording.wav'}
function backend(responses: Array<{data: unknown;error: unknown}>) {
 const rpc=jest.fn()
 for(const result of responses)rpc.mockResolvedValueOnce(result)
 const remove=jest.fn().mockResolvedValue({data:[],error:null})
 const from=jest.fn().mockReturnValue({remove})
 return {client:{rpc,storage:{from}} as unknown as SupabaseClient<Database>,rpc,remove,from}
}
const ok=(data:unknown)=>({data,error:null})
afterEach(()=>jest.restoreAllMocks())
it('requires an explicit confirmation and rejects a caller-selected user ID',()=>{
 expect(resetUserProgressSchema.safeParse({confirmation:'RESET_LEARNING_DATA'}).success).toBe(true)
 for(const input of [{},{confirmation:true},{confirmation:'yes'},{confirmation:'RESET_LEARNING_DATA',userId:token}])expect(resetUserProgressSchema.safeParse(input).success).toBe(false)
})
it('deletes only pronunciation recordings through Storage before finalizing learning rows',async()=>{
 const b=backend([ok(token),ok([current]),ok([]),ok(true)])
 expect(await performLearningReset(b.client)).toEqual({success:true})
 expect(b.rpc.mock.calls).toEqual([
 ['begin_learning_reset',{p_confirmation:'RESET_LEARNING_DATA'}],
 ['learning_reset_audio_batch',{p_token:token}],['learning_reset_audio_batch',{p_token:token}],['finish_learning_reset',{p_token:token}],
 ])
 expect(b.from.mock.calls).toEqual([['pronunciation_audio']])
 expect(b.remove.mock.calls).toEqual([[[current.object_name]]])
 expect(b.remove.mock.invocationCallOrder.at(-1)).toBeLessThan(b.rpc.mock.invocationCallOrder.at(-1)!)
})
it('an account without recordings can finish without issuing a Storage request',async()=>{
 const b=backend([ok(token),ok([]),ok(true)])
 expect(await performLearningReset(b.client)).toEqual({success:true});expect(b.remove).not.toHaveBeenCalled()
})
it('a failed Storage request does not finalize or erase the persisted retry manifest',async()=>{
 const b=backend([ok(token),ok([current])]);b.remove.mockResolvedValueOnce({data:null,error:new Error('network unavailable')})
 expect(await performLearningReset(b.client)).toEqual({success:false,reason:'reset_failed'})
 expect(b.rpc).not.toHaveBeenCalledWith('finish_learning_reset',expect.anything())
})
it('resumption processes only the files still returned by the persisted manifest',async()=>{
 const b=backend([ok(token),ok([current]),ok([]),ok(true)])
 expect(await performLearningReset(b.client)).toEqual({success:true});expect(b.from).toHaveBeenCalledTimes(1);expect(b.from).toHaveBeenCalledWith('pronunciation_audio')
})
it('does not mistake a successful no-op deletion for completion',async()=>{
 const b=backend([ok(token),ok([current]),ok([current])])
 expect(await performLearningReset(b.client)).toEqual({success:false,reason:'reset_failed'});expect(b.remove).toHaveBeenCalledTimes(1)
})
it('a failed database finalization stays retryable and is never reported as success',async()=>{
 const b=backend([ok(token),ok([]),{data:null,error:new Error('transaction failed')}])
 expect(await performLearningReset(b.client)).toEqual({success:false,reason:'reset_failed'})
})
it('rejects unexpected RPC data before it can delete assets or shared TTS files',async()=>{
 for(const data of [[{bucket_id:'audio_submissions',object_name:'owner-123.wav'}],[{bucket_id:'audio_cache',object_name:'cached.mp3'}],[{bucket_id:'assets',object_name:'avatar.png'}],null,[{bucket_id:'pronunciation_audio',object_name:''}]]){
 const b=backend([ok(token),ok(data)])
 expect(await performLearningReset(b.client)).toEqual({success:false,reason:'reset_failed'});expect(b.remove).not.toHaveBeenCalled()
 }
})
it('caps each Storage request below the 1000-object limit and drains successive pages',async()=>{
 const first=Array.from({length:500},(_,i)=>({...current,object_name:`owner/${i}.wav`}))
 const second=Array.from({length:500},(_,i)=>({...current,object_name:`owner/${i+500}.wav`}))
 const b=backend([ok(token),ok(first),ok(second),ok([current]),ok([]),ok(true)])
 expect(await performLearningReset(b.client)).toEqual({success:true});expect(b.remove.mock.calls.map(call=>call[0].length)).toEqual([500,500,1])
})
it('returns a resumable status before exceeding the server request budget',async()=>{
 const clock=jest.spyOn(Date,'now');clock.mockReturnValueOnce(0).mockReturnValue(20_001)
 const b=backend([ok(token)]);expect(await performLearningReset(b.client)).toEqual({success:false,reason:'reset_in_progress'});expect(b.remove).not.toHaveBeenCalled()
})
it('retries a rolled-back final transaction after a database deadlock without restarting the reset',async()=>{
 const b=backend([ok(token),ok([]),{data:null,error:{code:'40P01'}},ok(true)])
 expect(await performLearningReset(b.client)).toEqual({success:true})
 expect(b.rpc.mock.calls.filter(call=>call[0]==='begin_learning_reset')).toHaveLength(1)
 expect(b.rpc.mock.calls.filter(call=>call[0]==='finish_learning_reset')).toHaveLength(2)
})
it('limits deadlock retries and leaves persistent failures resumable',async()=>{
 const failure={data:null,error:{code:'40P01'}}
 const b=backend([failure,failure,failure])
 expect(await performLearningReset(b.client)).toEqual({success:false,reason:'reset_failed'});expect(b.rpc).toHaveBeenCalledTimes(3)
})
