'use server'

import { z } from 'zod'
import { headers } from 'next/headers'
import { createAdminClient } from '@/utils/supabase/admin'
import { type EnrollmentFormData } from '@/lib/registration-schema'
import { rateLimit } from '@/lib/ratelimit'

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
  selectedCourseIds: z.array(field(100)).min(1).max(100).refine(ids => new Set(ids).size === ids.length),
  startDate: dateSchema, totalPrice: z.number().finite().min(0).max(100000),
  consents: z.object({ privacy: z.literal(true), agb: z.literal(true), revocation: z.boolean(), videoRecording: z.boolean().optional() }).strict(),
  coursePrices: z.record(z.string(), z.number().finite().min(0).max(100000)),
}).strict()

/** A public enrollment may record the submitted details, but never update an
 * existing person's email/address. Guessing a name and birth date is not proof
 * of identity. The immutable snapshot lets staff review each actual request. */
export async function submitEnrollment(
  formData: EnrollmentFormData, selectedCourseIds: string[], startDateRaw: string, totalPrice: number,
  consents: { privacy: boolean; agb: boolean; revocation: boolean; videoRecording?: boolean },
  coursePrices: Record<string, number>,
): Promise<SubmitEnrollmentResult> {
  try {
    const input = enrollmentSchema.safeParse({ ...formData, selectedCourseIds, startDate: startDateRaw, totalPrice, consents, coursePrices })
    if (!input.success) return { success: false, message: 'generic_error' }
    const headerList = await headers()
    const ip = headerList.get('x-nf-client-connection-ip') ?? headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const limit = await rateLimit(`enrollment:${ip}`, 3, '60 m')
    if (!limit.success) return { success: false, message: 'generic_error' }
    const admin = createAdminClient()
    const { personal, selectedCourseIds: ids, consents: accepted } = input.data
    const catalog = await admin.from('courses').select('id').in('id', ids)
    if (catalog.error || catalog.data?.length !== ids.length) return { success: false, message: 'generic_error' }
    // Equality on all identity fields avoids changing another person's record.
    // Different details create a separate reviewable request; shared emails are
    // never automatically resolved by taking the first match.
    const existing = await admin.from('users').select('id').eq('first_name', personal.firstName)
      .eq('last_name', personal.lastName).eq('birth_date', personal.birthDate)
      .ilike('email', personal.email.replace(/[\\%_]/g, value => `\\${value}`)).limit(2)
    if (existing.error) throw new Error('person_lookup_failed')
    let personId = existing.data?.length === 1 ? existing.data[0].id : null
    if (!personId) {
      const created = await admin.from('users').insert({
        first_name: personal.firstName, last_name: personal.lastName, birth_date: personal.birthDate,
        email: personal.email, phone: personal.phone || null, street: personal.street, zip: personal.zip, city: personal.city,
      }).select('id').single()
      if (created.error || !created.data) throw new Error('person_create_failed')
      personId = created.data.id
    }
    const [day, month, year] = input.data.startDate.split('.')
    const registration = await admin.from('registrations').insert({
      user_id: personId, start_date: `${year}-${month}-${day}`, total_price: input.data.totalPrice,
      privacy_accepted: accepted.privacy, agb_accepted: accepted.agb,
      revocation_waiver_accepted: accepted.revocation, video_recording_accepted: accepted.videoRecording ?? null,
      status: 'pending', course_ids: ids, course_prices: Object.fromEntries(ids.map(id => [id, input.data.coursePrices[id] ?? 0])),
      contact_snapshot: {
        first_name: personal.firstName, last_name: personal.lastName, birth_date: personal.birthDate,
        email: personal.email, phone: personal.phone || null, street: personal.street, zip: personal.zip, city: personal.city,
      },
    })
    if (registration.error) throw new Error('registration_create_failed')
    return { success: true, message: 'registration_success' }
  } catch {
    // Never return DB errors or log submitted personal information.
    console.error('[enrollment] Registration could not be saved')
    return { success: false, message: 'generic_error' }
  }
}
