import 'server-only'
import { createClient } from '@/utils/supabase/server'
import { sitovSpecialStaffInputSchema,sitovSpecialStaffResultSchema,type SitovSpecialStaffResult } from './sitov-learning-specials-staff-contract'
/** Private staff diagnostic only. SQL performs current role/MFA checks on every request. */
export async function loadSitovSpecialStaffCatalog(input:unknown):Promise<SitovSpecialStaffResult>{
 const v=sitovSpecialStaffInputSchema.safeParse(input)
 if(!v.success)return {ok:false,error:'invalid_input',retryable:false}
 try{
  const client=await createClient();const auth=await client.auth.getUser()
  if(auth.error||!auth.data.user)return {ok:false,error:'authentication_required',retryable:false}
  const {data,error}=await client.rpc('sitov_special_staff_catalog',{p_node_id:v.data.nodeId})
  if(error)return {ok:false,error:'retryable_failure',retryable:true}
  const result=sitovSpecialStaffResultSchema.parse(data)
  if(result.ok&&result.data.definitions.some(d=>d.node_id!==v.data.nodeId))return {ok:false,error:'retryable_failure',retryable:true}
  return result
 }catch{return {ok:false,error:'retryable_failure',retryable:true}}
}
