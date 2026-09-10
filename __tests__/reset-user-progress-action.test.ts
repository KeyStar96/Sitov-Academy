jest.mock('next/cache',()=>({revalidatePath:jest.fn()}))
jest.mock('@/utils/supabase/server',()=>({createClient:jest.fn()}))
jest.mock('@/lib/reset-user-progress',()=>({performLearningReset:jest.fn()}))
import {revalidatePath} from 'next/cache'
import {createClient} from '@/utils/supabase/server'
import {performLearningReset} from '@/lib/reset-user-progress'
import {resetUserProgress} from '@/app/actions/resetUserProgress'
const input={confirmation:'RESET_LEARNING_DATA'} as const
function setup(user: {id:string}|null,error: unknown=null){
 const client={auth:{getUser:jest.fn().mockResolvedValue({data:{user},error})}}
 jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
 return client
}
beforeEach(()=>{jest.clearAllMocks();jest.mocked(revalidatePath).mockImplementation(()=>{});jest.mocked(performLearningReset).mockResolvedValue({success:true})})
it('rejects malformed confirmation before creating a client',async()=>{
 expect(await resetUserProgress({confirmation:'yes'} as unknown as typeof input)).toEqual({success:false,reason:'invalid_input'});expect(createClient).not.toHaveBeenCalled()
})
it('requires a verified server session before starting a reset',async()=>{
 setup(null);expect(await resetUserProgress(input)).toEqual({success:false,reason:'not_authenticated'});expect(performLearningReset).not.toHaveBeenCalled()
 setup({id:'owner'},new Error('session invalid'));expect(await resetUserProgress(input)).toEqual({success:false,reason:'not_authenticated'});expect(performLearningReset).not.toHaveBeenCalled()
})
it('uses the session-bound client without a browser-provided user ID and refreshes only after completion',async()=>{
 const client=setup({id:'owner'});expect(await resetUserProgress(input)).toEqual({success:true});expect(performLearningReset).toHaveBeenCalledWith(client)
 expect(revalidatePath).toHaveBeenCalledWith('/[lang]/dashboard','layout')
})
it('preserves an operation failure and does not invalidate routes as if it completed',async()=>{
 setup({id:'owner'});jest.mocked(performLearningReset).mockResolvedValue({success:false,reason:'reset_failed'})
 expect(await resetUserProgress(input)).toEqual({success:false,reason:'reset_failed'});expect(revalidatePath).not.toHaveBeenCalled()
})
it('a cache refresh failure after committed reset cannot turn success into a second destructive retry',async()=>{
 setup({id:'owner'});jest.mocked(revalidatePath).mockImplementation(()=>{throw new Error('cache unavailable')})
 expect(await resetUserProgress(input)).toEqual({success:true});expect(performLearningReset).toHaveBeenCalledTimes(1)
})
