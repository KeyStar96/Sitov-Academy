'use server'
import {createAdminClient} from '@/utils/supabase/admin'
import {headers} from 'next/headers'
import {rateLimit} from '@/lib/ratelimit'
import {z} from 'zod'
import type {CancellationFormData} from '@/lib/cancellation-schema'
const schema=z.object({fullName:z.string().trim().min(2).max(160),email:z.string().trim().email().max(254),courseName:z.string().trim().max(200).optional(),terminationDate:z.enum(['asap','specific_date']),specificDate:z.string().regex(/^\d{2}\.\d{2}\.\d{4}$/).optional()})
export async function submitCancellation(input:CancellationFormData,lang:string):Promise<{success:boolean;message?:string}> {
 try {
  const data=schema.parse(input),h=await headers();const limit=await rateLimit(`cancel:${h.get('x-forwarded-for')?.split(',')[0]??'unknown'}`,3,'60 m')
  if(!limit.success)return {success:false,message:'generic_error'}
  const client=createAdminClient()
  const {error}=await client.rpc('submit_business_cancellation',{p_name:data.fullName,p_email:data.email,p_course:data.courseName??'',p_type:data.terminationDate,p_date:data.terminationDate==='specific_date'?data.specificDate?.split('.').reverse().join('-'):undefined,p_locale:lang})
  if(error)throw error
  return {success:true}
 }catch{console.error('[cancellation] Request failed');return {success:false,message:'generic_error'}}
}
