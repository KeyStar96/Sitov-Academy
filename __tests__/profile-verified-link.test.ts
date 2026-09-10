jest.mock('server-only',()=>({}),{virtual:true})
jest.mock('next/cache',()=>({revalidatePath:jest.fn()}))
jest.mock('@/utils/supabase/server',()=>({createClient:jest.fn()}))
import { createClient } from '@/utils/supabase/server'
import { resolveLegacyProfile } from '@/lib/profile-legacy'
import type { User } from '@supabase/supabase-js'
const user={id:'00000000-0000-4000-8000-000000000001',email:'verified@test.invalid',email_confirmed_at:'2026-01-01'} as User
beforeEach(()=>jest.clearAllMocks())
it('never looks up data for an unverified signup',async()=>{
 expect(await resolveLegacyProfile({...user,email_confirmed_at:undefined})).toEqual({id:null,unresolved:false})
 expect(createClient).not.toHaveBeenCalled()
})
it('accepts only the identity claimed by the authenticated database RPC; email and user ID are not request parameters',async()=>{
 const rpc=jest.fn().mockResolvedValue({data:{id:'00000000-0000-4000-8000-000000000099',unresolved:false},error:null})
 jest.mocked(createClient).mockResolvedValue({rpc} as unknown as Awaited<ReturnType<typeof createClient>>)
 expect((await resolveLegacyProfile(user)).id).toBe('00000000-0000-4000-8000-000000000099')
 expect(rpc).toHaveBeenCalledWith('claim_verified_legacy_profile')
})
it('does not turn a failed identity lookup into a match',async()=>{
 const rpc=jest.fn().mockResolvedValue({data:null,error:{code:'42501'}})
 jest.mocked(createClient).mockResolvedValue({rpc} as unknown as Awaited<ReturnType<typeof createClient>>)
 await expect(resolveLegacyProfile(user)).rejects.toThrow('not_authorized')
})
