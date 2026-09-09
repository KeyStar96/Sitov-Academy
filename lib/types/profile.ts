import { z } from 'zod'
import type { Tables } from '@/supabase/database.types'
import { plainTextSchema, type ProfileRole } from './backend'

export type Profile = Omit<Tables<'profiles'>, 'role'> & { role: ProfileRole | null }
export type ProfileContact = Pick<Profile, 'phone' | 'street' | 'zip_code' | 'city'>
const contactField = (max: number) => plainTextSchema(max)
  .refine(value => !value.includes('\n')).nullable()

/** All four fields are required; null explicitly clears a value. */
export const profileContactSchema = z.object({
  phone: contactField(50),
  street: contactField(250),
  zip_code: contactField(32),
  city: contactField(120),
}).strict()
export type UpdateProfileContactInput = z.infer<typeof profileContactSchema>

export const personalDetailsSchema = profileContactSchema.extend({
  name: plainTextSchema(80).refine(value => !value.includes('\n')),
  email: z.string().trim().max(180).email().transform(value => value.toLowerCase()),
  lang: z.enum(['de', 'en', 'uk', 'ru', 'tr']),
}).strict()
export type PersonalDetails = ProfileContact & { name: string; email: string }
export interface PersonalDetailsResult {
  profile: PersonalDetails
  pendingEmail: string | null
  emailChange: 'unchanged' | 'pending' | 'updated' | 'failed'
}
