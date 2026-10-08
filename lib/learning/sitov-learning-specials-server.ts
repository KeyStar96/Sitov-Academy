import 'server-only'
import { createClient } from '@/utils/supabase/server'
import { sitovSpecialInputSchema,sitovSpecialResultSchema,type SitovSpecialResult } from './sitov-learning-specials-contract'
import type { Json } from '@/supabase/database.types'
/** SQL enforces exact account/item/version/CAS. No client score or self-assessed test passage. */
export async function performSitovSpecialOperation(input:unknown):Promise<SitovSpecialResult>{
 const v=sitovSpecialInputSchema.safeParse(input)
 if(!v.success)return {ok:false,error:'invalid_input',retryable:false}
 try{
  const client=await createClient();const auth=await client.auth.getUser()
  if(auth.error||!auth.data.user)return {ok:false,error:'authentication_required',retryable:false}
  // New RPC types are a proposed M-owned patch; the narrow local port avoids changing shared types.
  const rpc=client.rpc as unknown as (name:'sitov_special_operation',args:Record<string,Json>)=>Promise<{data:unknown;error:unknown}>
  const {data,error}=await rpc.call(client,'sitov_special_operation',{p_operation:v.data.operation,p_node_id:v.data.nodeId??null,p_run_id:v.data.runId??null,p_mode:v.data.mode??null,p_revision:v.data.revision??null,p_request_id:v.data.requestId??null,p_answers:(v.data.answers??null) as Json,p_locale:v.data.locale})
  if(error)return {ok:false,error:'retryable_failure',retryable:true}
  return sitovSpecialResultSchema.parse(data)
 }catch{return {ok:false,error:'retryable_failure',retryable:true}}
}
