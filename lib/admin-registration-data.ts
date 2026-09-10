import 'server-only'
import { z } from 'zod'
import { createAdminClient } from '@/utils/supabase/admin'
import { checkDatabaseError } from './actions/backend'
import type { Tables } from '@/supabase/database.types'
import type { RegistrationContact, StaffRegistration, RegistrationOverview, StaffInvoice } from './types/admin-registrations'

const snapshotSchema = z.object({ first_name: z.string(), last_name: z.string(), email: z.string(),
  phone: z.string().nullable(), street: z.string().nullable(), zip: z.string().nullable(), city: z.string().nullable(), birth_date: z.string(),
})
export function legacyContact(person: Tables<'users'>, snapshot?: unknown): RegistrationContact {
  const parsed = snapshotSchema.safeParse(snapshot)
  const data = parsed.success ? parsed.data : person
  return { name: `${data.first_name} ${data.last_name}`.trim(), email: data.email, phone: data.phone,
    street: data.street, zip: data.zip, city: data.city, birthDate: data.birth_date }
}
async function allRows<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { code: string } | null }>): Promise<T[]> {
  const rows: T[] = []
  for (let start = 0; ; start += 1000) {
    const result = await query(start, start + 999)
    checkDatabaseError(result.error)
    rows.push(...(result.data ?? []))
    if ((result.data?.length ?? 0) < 1000) return rows
  }
}
/** Caller must first pass withBackendSession(..., 'staff'). This service-side
 * read includes legacy pupils who do not yet have a learning-platform account. */
export async function loadRegistrationOverview(month: string): Promise<RegistrationOverview> {
  const admin = createAdminClient()
  const [registrations, people, profiles, monthly, catalog, enrollments, invoiceRows] = await Promise.all([
    allRows<Tables<'registrations'>>((a,b) => admin.from('registrations').select('*').order('id').range(a,b)),
    allRows<Tables<'users'>>((a,b) => admin.from('users').select('*').order('id').range(a,b)),
    allRows<Tables<'profiles'>>((a,b) => admin.from('profiles').select('*').order('id').range(a,b)),
    allRows<Tables<'monthly_course_bookings'>>((a,b) => admin.from('monthly_course_bookings').select('*').eq('target_month',month).order('id').range(a,b)),
    allRows<Tables<'courses'>>((a,b) => admin.from('courses').select('*').order('id').range(a,b)),
    allRows<Tables<'enrollments'>>((a,b) => admin.from('enrollments').select('*').order('registration_id').order('course_id').range(a,b)),
    allRows<Tables<'manual_invoice_status'>>((a,b) => admin.from('manual_invoice_status').select('*').eq('target_month',month).order('id').range(a,b)),
  ])
  const personById = new Map(people.map(person => [person.id, person]))
  const profileById = new Map(profiles.map(profile => [profile.id,profile]))
  const linkedProfiles = new Map(profiles.filter(profile => profile.legacy_user_id).map(profile => [profile.legacy_user_id,profile.id]))
  const courses = new Map(catalog.map(course => [course.id,course]))
  const courseByBooking = new Map(catalog.map(course => [course.booking_id,course]))
  const rows: StaffRegistration[] = []
  for (const registration of registrations) {
    const person = personById.get(registration.user_id)
    if (!person) continue
    const selectedIds = [...new Set([...(registration.course_ids ?? []), ...enrollments.filter(row => row.registration_id === registration.id).map(row => row.course_id)])]
    const prices = z.record(z.string(),z.number()).safeParse(registration.course_prices)
    rows.push({ id: registration.id, source:'registration', personId:person.id, profileId:linkedProfiles.get(person.id) ?? null,
      createdAt:registration.created_at,startDate:registration.start_date,targetMonth:null,
      status:z.enum(['pending','confirmed','cancelled','rejected']).parse(registration.status),
      contact:legacyContact(person, registration.contact_snapshot), totalPrice:registration.total_price,
      consents:{privacy:registration.privacy_accepted,agb:registration.agb_accepted,revocation:registration.revocation_waiver_accepted,recording:registration.video_recording_accepted},
      courses:selectedIds.map(id => {const course = courses.get(id);return {id,title:course?.title ?? id,translationKey:course?.translation_key ?? '',price:prices.success ? prices.data[id] ?? null : enrollments.find(row=>row.registration_id===registration.id && row.course_id===id)?.price ?? null,endDate:course?.end_date ?? null}}),
    })
  }
  for (const booking of monthly) {
    const profile = profileById.get(booking.user_id)
    if (!profile) continue
    rows.push({id:booking.id,source:'monthly_booking',personId:profile.legacy_user_id ?? profile.id,profileId:profile.id,
      createdAt:null,startDate:booking.target_month,targetMonth:booking.target_month,
      status:z.enum(['pending','confirmed','cancelled']).parse(booking.status),
      contact:{name:profile.name ?? '',email:profile.email,phone:profile.phone,street:profile.street,zip:profile.zip_code,city:profile.city,birthDate:profile.legacy_user_id ? personById.get(profile.legacy_user_id)?.birth_date ?? null : null},
      totalPrice:null,consents:null,courses:booking.course_ids.map(id=> {const course=courseByBooking.get(id);return {id:course?.id ?? id,title:course?.title ?? id,translationKey:course?.translation_key ?? '',price:null,endDate:course?.end_date ?? null}}),
    })
  }
  const invoices:StaffInvoice[] = invoiceRows.map(row=>({source:row.registration_id?'registration':'monthly_booking',sourceId:row.registration_id ?? row.monthly_booking_id!,month:row.target_month,status:row.status==='created'?'created':'outstanding',reference:row.invoice_reference,createdAt:row.invoice_created_at}))
  return { registrations: rows.sort((a,b)=>(b.createdAt ?? b.startDate ?? '').localeCompare(a.createdAt ?? a.startDate ?? '')),invoices,targetMonth:month }
}
