jest.mock('server-only',()=>({}),{virtual:true})
jest.mock('next/cache',()=>({revalidatePath:jest.fn()}))
jest.mock('@/utils/supabase/server',()=>({createClient:jest.fn()}))
jest.mock('@/lib/admin-registration-data',()=>({loadRegistrationOverview:jest.fn()}))
import { createClient } from '@/utils/supabase/server'
import { confirmRegistration, saveManualInvoiceStatus, getRegistrationOverview } from '@/app/actions/admin-registrations'
import { loadRegistrationOverview } from '@/lib/admin-registration-data'
const id='00000000-0000-4000-8000-000000000001'
function setup(role:string,userPresent=true){
 const rpc=jest.fn().mockResolvedValue({data:{status:'confirmed'},error:null})
 const profile={select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),single:jest.fn().mockResolvedValue({data:{role},error:null})}
 const db={auth:{getUser:jest.fn().mockResolvedValue({data:{user:userPresent?{id}:null},error:null})},from:jest.fn().mockReturnValue(profile),rpc}
 jest.mocked(createClient).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof createClient>>)
 return db
}
beforeEach(()=>jest.clearAllMocks())
it('denies students and signed-out callers before any privileged read or write',async()=>{
 for(const [role,present,error] of [['student',true,'not_authorized'],['teacher',false,'not_authenticated']] as const){
  const db=setup(role,present)
  expect(await confirmRegistration({source:'registration',id})).toEqual({success:false,error})
  expect(await getRegistrationOverview()).toEqual({success:false,error})
  expect(db.rpc).not.toHaveBeenCalled();expect(loadRegistrationOverview).not.toHaveBeenCalled()
 }
})
it('teacher role comes from the profile, and accepted mutation has only source and ID',async()=>{
 const db=setup('teacher')
 expect(await confirmRegistration({source:'registration',id})).toEqual({success:true,data:{status:'confirmed'}})
 expect(db.rpc).toHaveBeenCalledWith('confirm_staff_registration',{p_source:'registration',p_id:id})
})
it('invoice status uses a separate per-month RPC and never changes payment or registration status',async()=>{
 const db=setup('admin')
 expect(await saveManualInvoiceStatus({source:'registration',id,month:'2026-10-01',created:true,reference:' RE1 '})).toEqual({success:true,data:{saved:true}})
 expect(db.rpc).toHaveBeenCalledWith('set_manual_invoice_status',{p_source:'registration',p_id:id,p_month:'2026-10-01',p_created:true,p_reference:'RE1'})
})
it('maps stale cancelled registrations to conflict without returning SQL errors',async()=>{
 const db=setup('teacher');db.rpc.mockResolvedValue({data:null,error:{code:'40001'}})
 expect(await confirmRegistration({source:'registration',id})).toEqual({success:false,error:'conflict'})
})
