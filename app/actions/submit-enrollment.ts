'use server'

import { z } from 'zod'
import { courseSelectionsSchema, courseSelectionsForRpc, type CourseSelection } from '@/lib/course-selection'
import { headers } from 'next/headers'
import { createAdminClient } from '@/utils/supabase/admin'
import { type EnrollmentFormData } from '@/lib/registration-schema'
import { rateLimit } from '@/lib/ratelimit'
import { getRpcError } from '@/lib/rpc-errors'

export interface SubmitEnrollmentResult { success: boolean; message: string; error?: 'generic_error' }
const field = (max: number) => z.string().trim().min(1).max(max).refine(value => !/[<>\u0000-\u001f]/.test(value))
const dateSchema = z.string().regex(/^\d{2}\.\d{2}\.\d{4}$/).refine(value => {
  const [day, month, year] = value.split('.').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
})
const enrollmentSchema = z.object({
  personal: z.object({ firstName: field(50), lastName: field(50), birthDate: dateSchema,
    email: z.string().trim().email().max(100).transform(value => value.toLowerCase()),
    phone: z.string().trim().max(50).optional(), street: field(100), zip: z.string().regex(/^\d{5}$/), city: field(100),
  }).strict(),
  courseSelections: courseSelectionsSchema.refine(rows => rows.length > 0),
  startDate: dateSchema,
  consents: z.object({ privacy: z.literal(true), agb: z.literal(true), revocation: z.boolean(), videoRecording: z.boolean().optional() }).strict(),
}).strict()

/** A public enrollment may record the submitted details, but never update an
 * existing person's email/address. Guessing a name and birth date is not proof
 * of identity. The immutable snapshot lets staff review each actual request. */
export async function submitEnrollment(
  formData: EnrollmentFormData, courseSelections: CourseSelection[], startDateRaw: string,
  consents: { privacy: boolean; agb: boolean; revocation: boolean; videoRecording?: boolean },
  locale: string = 'de',
): Promise<SubmitEnrollmentResult> {
  try {
    const input = enrollmentSchema.safeParse({ ...formData, courseSelections, startDate: startDateRaw, consents })
    if (!input.success) return { success: false, message: 'generic_error' }
    const headerList = await headers()
    const ip = headerList.get('x-nf-client-connection-ip') ?? headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const limit = await rateLimit(`enrollment:${ip}`, 3, '60 m')
    if (!limit.success) return { success: false, message: 'generic_error' }
    const admin = createAdminClient()
    const { personal, courseSelections: selections, consents: accepted } = input.data
    const iso=(value:string)=>value.split('.').reverse().join('-')
    const {data:result,error}=await admin.rpc('submit_business_registration',{
      p_contact:{name:`${personal.firstName} ${personal.lastName}`,email:personal.email,birth_date:iso(personal.birthDate),phone:personal.phone||null,street:personal.street,postal_code:personal.zip,city:personal.city},
      p_course_selections:courseSelectionsForRpc(selections),p_start:iso(input.data.startDate),p_consents:{privacy:accepted.privacy,agb:accepted.agb,revocation:accepted.revocation,recording:accepted.videoRecording??null},p_locale:locale,p_trial:false,
    })
    if(error || getRpcError(result) || !z.uuid().safeParse(result).success)throw new Error('registration_failed')
    return { success: true, message: 'registration_success' }
  } catch {
    // Never return DB errors or log submitted personal information.
    console.error('[enrollment] Registration could not be saved')
    return { success: false, message: 'generic_error' }
  }
}
