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

import {sitovSpecialAuthorContextInputSchema,sitovSpecialAuthorInputSchema,sitovSpecialAuthorContextResultSchema,sitovSpecialAuthorResultSchema,type SitovSpecialAuthorResult,type SitovSpecialAuthorContextResult} from './sitov-learning-specials-staff-contract'
/** Frozen101 typed author RPCs; cookie-scoped client only. */
export async function loadSitovSpecialAuthorContext(input:unknown):Promise<SitovSpecialAuthorContextResult>{
 const v=sitovSpecialAuthorContextInputSchema.safeParse(input)
 if(!v.success)return {ok:false,error:'invalid_input',retryable:false}
 try{
  const client=await createClient();const auth=await client.auth.getUser()
  if(auth.error||!auth.data.user)return {ok:false,error:'authentication_required',retryable:false}
  const {data,error}=await client.rpc('sitov_special_author_context',{p_unit_id:v.data.unitId,p_anchor_id:v.data.anchorNodeId,p_source_ref:v.data.sourceRef})
  if(error)throw error
  const result=sitovSpecialAuthorContextResultSchema.parse(data)
  if(result.ok&&(result.data.unitId!==v.data.unitId||result.data.anchorNodeId!==v.data.anchorNodeId||result.data.sourceRef!==v.data.sourceRef))throw new Error('response_identity')
  return result
 }catch{return {ok:false,error:'retryable_failure',retryable:true}}
}
export async function createSitovSpecialAuthorDraft(input:unknown):Promise<SitovSpecialAuthorResult>{
 const v=sitovSpecialAuthorInputSchema.safeParse(input)
 if(!v.success)return {ok:false,error:'invalid_input',retryable:false}
 try{
  const client=await createClient();const auth=await client.auth.getUser()
  if(auth.error||!auth.data.user)return {ok:false,error:'authentication_required',retryable:false}
  const {data,error}=await client.rpc('sitov_special_author_create',{p_input:v.data})
  if(error)throw error
  const result=sitovSpecialAuthorResultSchema.parse(data)
  if(result.ok&&(result.data.unitId!==v.data.unitId||result.data.anchorNodeId!==v.data.anchorNodeId||result.data.sourceRef!==v.data.sourceRef||result.data.sourceSha256!==v.data.sourceSha256||JSON.stringify(result.data.itemIds)!==JSON.stringify(v.data.items.map(i=>i.id))))throw new Error('response_identity')
  return result
 }catch{return {ok:false,error:'retryable_failure',retryable:true}}
}
