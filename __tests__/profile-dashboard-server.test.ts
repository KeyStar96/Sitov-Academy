jest.mock('server-only',()=>({}),{virtual:true})
jest.mock('next/cache',()=>({revalidatePath:jest.fn()}))
jest.mock('@/utils/supabase/server',()=>({createClient:jest.fn()}))
jest.mock('@/lib/profile-legacy',()=>({resolveLegacyProfile:jest.fn().mockResolvedValue({id:null,unresolved:false})}))
jest.mock('@/lib/site-url',()=>({getOutboundSiteUrl:async()=> 'https://example.invalid',buildSiteUrl:()=> 'https://example.invalid/auth/callback?lang=uk'}))
import { createClient } from '@/utils/supabase/server'
import { updatePersonalDetails } from '@/app/actions/profile'
import { saveNextMonthBooking } from '@/app/actions/monthly-bookings'
import { resolveLegacyProfile } from '@/lib/profile-legacy'
import { profileMonthWindow } from '@/lib/profile-month'

const uid='00000000-0000-4000-8000-000000000001'
const profile={name:'Anna',email:'old@example.invalid',phone:null,street:null,zip_code:'00123',city:'Berlin'}
function setup(emailFails=false,profileFails=false) {
  const user={id:uid,email:profile.email,email_confirmed_at:'2026-01-01T00:00:00Z'}
  const role={select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),single:jest.fn().mockResolvedValue({data:{role:'student'},error:null})}
  const mutate={update:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),select:jest.fn().mockReturnThis(),single:jest.fn().mockResolvedValue({data:profileFails?null:profile,error:profileFails?{code:'42501'}:null})}
  const rpc={single:jest.fn().mockResolvedValue({data:{id:uid,user_id:uid,target_month:profileMonthWindow().next,course_ids:[],status:'cancelled'},error:null})}
  const client={auth:{getUser:jest.fn().mockResolvedValue({data:{user},error:null}),updateUser:jest.fn().mockResolvedValue({data:{user:{...user,new_email:'new@example.invalid'}},error:emailFails?{code:'over_email_send_rate_limit'}:null})},from:jest.fn().mockReturnValueOnce(role).mockReturnValue(mutate),rpc:jest.fn().mockReturnValue(rpc)}
  jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  return {client,mutate,rpc,user}
}
beforeEach(()=>jest.clearAllMocks())
it('keeps verified email in profiles and requests confirmation through Auth',async()=>{
  const {client,mutate,user}=setup()
  const result=await updatePersonalDetails({...profile,email:'new@example.invalid',lang:'uk'})
  expect(mutate.update).toHaveBeenCalledWith({name:'Anna',phone:null,street:null,zip_code:'00123',city:'Berlin'})
  expect(resolveLegacyProfile).toHaveBeenCalledWith(user,true)
  expect(client.auth.updateUser).toHaveBeenCalledWith({email:'new@example.invalid'},{emailRedirectTo:'https://example.invalid/auth/callback?lang=uk'})
  expect(result).toEqual({success:true,data:{profile,pendingEmail:'new@example.invalid',emailChange:'pending'}})
})
it('returns partial success accurately if only the email request fails',async()=>{
  setup(true)
  expect(await updatePersonalDetails({...profile,email:'new@example.invalid',lang:'de'})).toEqual({success:true,data:{profile,pendingEmail:null,emailChange:'failed'}})
})
it('does not send email if the profile write fails',async()=>{
  const {client}=setup(false,true)
  expect(await updatePersonalDetails({...profile,email:'new@example.invalid',lang:'de'})).toEqual({success:false,error:'not_authorized'})
  expect(client.auth.updateUser).not.toHaveBeenCalled()
})
it('does not resend confirmation when email was not changed',async()=>{
  const {client}=setup()
  await updatePersonalDetails({...profile,lang:'de'})
  expect(client.auth.updateUser).not.toHaveBeenCalled()
})
it('rejects privilege fields before saving or sending confirmation',async()=>{
  const {client,mutate}=setup()
  expect(await updatePersonalDetails({...profile,lang:'de',role:'admin'})).toEqual({success:false,error:'invalid_input'})
  expect(mutate.update).not.toHaveBeenCalled();expect(client.auth.updateUser).not.toHaveBeenCalled()
})
it('saves pauses through the atomic RPC without taking an owner from the client',async()=>{
  const {client}=setup()
  expect((await saveNextMonthBooking({targetMonth:profileMonthWindow().next,courseIds:[],paused:true,expected:null})).success).toBe(true)
  expect(client.rpc).toHaveBeenCalledWith('save_next_month_booking',{p_target_month:profileMonthWindow().next,p_course_ids:[],p_paused:true,p_expected_id:null,p_expected_course_ids:null,p_expected_status:null})
})
it('maps concurrent-session conflicts without exposing SQL detail',async()=>{
  const {rpc}=setup()
  rpc.single.mockResolvedValue({data:null,error:{code:'40001',message:'Private SQL'}})
  expect(await saveNextMonthBooking({targetMonth:profileMonthWindow().next,courseIds:[],paused:true,expected:null})).toEqual({success:false,error:'conflict'})
})
