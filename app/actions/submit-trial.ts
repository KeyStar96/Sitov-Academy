'use server'
import {createAdminClient} from '@/utils/supabase/admin'
import {headers} from 'next/headers'
import {rateLimit} from '@/lib/ratelimit'
import {z} from 'zod'
import {getRpcError} from '@/lib/rpc-errors'
const schema=z.object({firstName:z.string().trim().min(1).max(80),lastName:z.string().trim().min(1).max(80),email:z.string().trim().email(),phone:z.string().max(50).optional(),birthDate:z.string().optional(),street:z.string().max(200).optional(),zip:z.string().max(30).optional(),city:z.string().max(120).optional(),courseId:z.string().uuid(),trialDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),videoRecordingAccepted:z.boolean().optional(),privacyAccepted:z.literal(true),agbAccepted:z.literal(true),locale:z.enum(['de','en','ru','uk','tr']).default('de')})
export interface SubmitTrialResult {success:boolean;message:string}
export async function submitTrialLesson(input:unknown):Promise<SubmitTrialResult> {
 try {
  const data=schema.parse(input);const h=await headers();const limit=await rateLimit(`trial:${h.get('x-forwarded-for')?.split(',')[0]??'unknown'}`,3,'60 m')
  if(!limit.success)return {success:false,message:'generic_error'}
  const client=createAdminClient();const {data:result,error}=await client.rpc('submit_business_registration',{
   p_contact:{name:`${data.firstName} ${data.lastName}`,email:data.email,birth_date:data.birthDate?.split('.').reverse().join('-')??null,phone:data.phone??null,street:data.street??null,postal_code:data.zip??null,city:data.city??null},
   p_course_selections:[{course_id:data.courseId}],p_start:data.trialDate,p_consents:{privacy:true,agb:true,recording:data.videoRecordingAccepted??null},p_locale:data.locale,p_trial:true,
  })
  if(error)return {success:false,message:error.code==='23505'?'trial_already_used':'generic_error'}
  const failure=getRpcError(result)
  if(failure)return {success:false,message:(failure.sqlstate??failure.error)==='23505'?'trial_already_used':'generic_error'}
  if(!z.uuid().safeParse(result).success)return {success:false,message:'generic_error'}
  return {success:true,message:'trial_success'}
 }catch{console.error('[trial] Request failed');return {success:false,message:'generic_error'}}
}
