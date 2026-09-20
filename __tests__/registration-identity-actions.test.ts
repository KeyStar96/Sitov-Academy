jest.mock('server-only',()=>({}),{virtual:true})
jest.mock('next/cache',()=>({revalidatePath:jest.fn()}))
jest.mock('@/utils/supabase/server',()=>({createClient:jest.fn()}))
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getRegistrationIdentityConflicts, resolveRegistrationIdentity } from '@/app/actions/registration-identity'

const personId='00000000-0000-4000-8000-000000000001',authUserId='00000000-0000-4000-8000-000000000002'
function setup(role='teacher',present=true) {
  const rpc=jest.fn().mockResolvedValue({data:{person_id:personId,auth_user_id:authUserId,resolved:true},error:null})
  const profile={select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),single:jest.fn().mockResolvedValue({data:{role},error:null})}
  const db={auth:{getUser:jest.fn().mockResolvedValue({data:{user:present?{id:authUserId}:null},error:null})},from:jest.fn().mockReturnValue(profile),rpc}
  jest.mocked(createClient).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof createClient>>)
  return db
}
beforeEach(()=>jest.clearAllMocks())
it.each([['student',true,'not_authorized'],['teacher',false,'not_authenticated']] as const)('denies %s / present=%s before reading collisions or assigning',async(role,present,error)=>{
  const db=setup(role,present)
  expect(await getRegistrationIdentityConflicts()).toEqual({success:false,error})
  expect(await resolveRegistrationIdentity({personId,authUserId,confirmed:true})).toEqual({success:false,error})
  expect(db.rpc).not.toHaveBeenCalled()
})
it('uses explicit IDs and staff confirmation, while identity and verified email checks remain in the database',async()=>{
  const db=setup()
  expect(await resolveRegistrationIdentity({personId,authUserId,confirmed:true})).toEqual({success:true,data:{person_id:personId,auth_user_id:authUserId,resolved:true}})
  expect(db.rpc).toHaveBeenCalledWith('resolve_registration_identity',{p_person_id:personId,p_auth_user_id:authUserId})
  expect(revalidatePath).toHaveBeenCalledWith('/[lang]/dashboard','layout')
})
it.each([{personId,authUserId},{personId,authUserId,confirmed:false},{personId,authUserId,confirmed:true,email:'other@example.test'},{personId:'invalid',authUserId,confirmed:true}])('rejects unsafe input %j',async input=>{
  const db=setup()
  expect(await resolveRegistrationIdentity(input)).toEqual({success:false,error:'invalid_input'})
  expect(db.rpc).not.toHaveBeenCalled()
})
it('does not mistake an R10 JSON error for a successful assignment',async()=>{
  const db=setup();db.rpc.mockResolvedValue({data:{error:'conflict',message:'Internal details'},error:null})
  expect(await resolveRegistrationIdentity({personId,authUserId,confirmed:true})).toEqual({success:false,error:'conflict'})
  expect(revalidatePath).not.toHaveBeenCalled()
})
it('validates staff-only collision data and rejects malformed RPC payloads',async()=>{
  const db=setup();const row={person_id:personId,display_name:'Anna',email:'family@example.test',booking_count:1,candidates:[{auth_user_id:authUserId,display_name:'Konto',email:'family@example.test',can_assign:true}]}
  db.rpc.mockResolvedValue({data:{conflicts:[row]},error:null})
  expect(await getRegistrationIdentityConflicts()).toEqual({success:true,data:[row]})
  db.rpc.mockResolvedValue({data:{error:'XX000',message:'private'},error:null})
  expect(await getRegistrationIdentityConflicts()).toEqual({success:false,error:'request_failed'})
})
