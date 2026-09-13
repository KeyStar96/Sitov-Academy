import { z } from 'zod'
import { uuidSchema } from './backend'
import { targetMonthSchema } from './monthly-bookings'

export const registrationSourceSchema = z.enum(['registration', 'monthly_booking'])
export type RegistrationSource = z.infer<typeof registrationSourceSchema>
export const staffConfirmationSchema = z.object({ source: registrationSourceSchema, id: uuidSchema }).strict()
export const invoiceStatusInputSchema = staffConfirmationSchema.extend({
  month: targetMonthSchema,
  created: z.boolean(),
  reference: z.string().trim().max(120).refine(value => !/[<>\u0000-\u001f]/.test(value)).default(''),
}).strict()
export interface RegistrationContact {
  name: string
  email: string
  phone: string | null
  street: string | null
  zip: string | null
  city: string | null
  birthDate: string | null
}
export interface RegistrationCourse {
  id: string
  title: string
  translationKey: string
  price: number | null
  endDate: string | null
}
export interface StaffRegistration {
  isTrial?: boolean
  id: string
  source: RegistrationSource
  personId: string
  profileId: string | null
  createdAt: string | null
  startDate: string | null
  targetMonth: string | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'rejected'
  contact: RegistrationContact
  courses: RegistrationCourse[]
  totalPrice: number | null
  consents: { privacy: boolean; agb: boolean; revocation: boolean; recording: boolean | null } | null
}
export interface StaffInvoice {
  source: RegistrationSource
  sourceId: string
  month: string
  status: 'outstanding' | 'created'
  reference: string | null
  createdAt: string | null
}
export interface RegistrationOverview {
  registrations: StaffRegistration[]
  invoices: StaffInvoice[]
  targetMonth: string
}
export interface VerifiedCourseHistory {
  unresolved: boolean
  birthDate?: string | null
  registrations: Pick<StaffRegistration, 'id' | 'status' | 'startDate' | 'courses'>[]
}
