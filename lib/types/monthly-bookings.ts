import { z } from 'zod'
import { uuidSchema } from './backend'

export const monthlyBookingStatusSchema = z.enum(['pending', 'confirmed', 'cancelled'])
export type MonthlyBookingStatus = z.infer<typeof monthlyBookingStatusSchema>
export interface MonthlyCourseBooking {
  id:string;user_id:string;target_month:string;course_ids:string[];status:MonthlyBookingStatus;revision?:number
}
export type MonthlyCourseBookingInsert = Omit<MonthlyCourseBooking,'id'>
export type MonthlyCourseBookingUpdate = Partial<MonthlyCourseBooking>
/** A calendar month, represented by its first day; no timezone conversion. */
export const targetMonthSchema = z.string().regex(/^(?!0000)\d{4}-(0[1-9]|1[0-2])-01$/)
/** Canonical course UUIDs; all public booking flows use the same identity. */
const courseIdsSchema = z.array(uuidSchema).min(1).max(100)
  .refine(ids => new Set(ids).size === ids.length)
export const createMonthlyBookingSchema = z.object({
  target_month: targetMonthSchema,
  course_ids: courseIdsSchema,
  // Optional admin override. Regular users can only use their own ID.
  user_id: uuidSchema.optional(),
}).strict()
export const updateMonthlyBookingSchema = z.object({
  id: uuidSchema,
  target_month: targetMonthSchema.optional(),
  course_ids: courseIdsSchema.optional(),
  status: monthlyBookingStatusSchema.optional(),
}).strict().refine(value => value.target_month !== undefined || value.course_ids !== undefined || value.status !== undefined)
export const listMonthlyBookingsSchema = z.object({
  user_id: uuidSchema.optional(),
  target_month: targetMonthSchema.optional(),
  offset: z.number().int().min(0).max(1_000_000).default(0),
  limit: z.number().int().min(1).max(100).default(50),
}).strict()
export type CreateMonthlyBookingInput = z.input<typeof createMonthlyBookingSchema>
export type UpdateMonthlyBookingInput = z.input<typeof updateMonthlyBookingSchema>
export type ListMonthlyBookingsInput = z.input<typeof listMonthlyBookingsSchema>

export interface ProfileCourse {
  id: string
  title: string | null
  translationKey: string
  type: 'online' | 'presence'
  available: boolean
}
export interface MonthlySelection {
  courseIds: string[]
  paused: boolean
}
export interface ProfileMonthlyState {
  targetMonth: string
  booking: MonthlyCourseBooking | null
  selection: MonthlySelection
  courses: ProfileCourse[]
  source: 'booking' | 'previous' | 'enrollments' | 'empty' | 'unresolved'
}
export const saveNextMonthSchema = z.object({
  targetMonth: targetMonthSchema,
  courseIds: z.array(uuidSchema).max(100).refine(ids => new Set(ids).size === ids.length),
  paused: z.boolean(),
  expected: z.object({
    id: uuidSchema,
    course_ids: z.array(uuidSchema).max(100),
    status: monthlyBookingStatusSchema,
    revision:z.number().int().positive().optional(),
  }).strict().nullable(),
}).strict().refine(value => value.paused || value.courseIds.length > 0)
