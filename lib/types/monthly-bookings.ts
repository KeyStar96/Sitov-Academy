import { z } from 'zod'
import { uuidSchema } from './backend'
import { courseSelectionsSchema, type CourseSelection } from '@/lib/course-selection'

export const monthlyBookingStatusSchema = z.enum(['pending', 'confirmed', 'cancelled'])
export type MonthlyBookingStatus = z.infer<typeof monthlyBookingStatusSchema>
export interface MonthlyCourseBooking {
  id: string
  userId: string
  targetMonth: string
  courseSelections: CourseSelection[]
  status: MonthlyBookingStatus
  revision: number
}
/** A calendar month, represented by its first day; no timezone conversion. */
export const targetMonthSchema = z.string().regex(/^(?!0000)\d{4}-(0[1-9]|1[0-2])-01$/)
export interface ProfileCourse {
  id: string
  slug: string
  title: string
  translations: {locale:string;title:string;description:string}[]
  type: 'online' | 'presence'
  category: string
  unitPrice: number
  unitMinutes: number
  available: boolean
}
export interface MonthlySelection {
  courseSelections: CourseSelection[]
  paused: boolean
}
export interface ProfileMonthlyState {
  targetMonth: string
  booking: MonthlyCourseBooking | null
  selection: MonthlySelection
  courses: ProfileCourse[]
  source: 'booking' | 'previous' | 'empty' | 'unresolved'
}
export const saveNextMonthSchema = z.object({
  targetMonth: targetMonthSchema,
  courseSelections: courseSelectionsSchema,
  paused: z.boolean(),
  expected: z.object({id: uuidSchema, revision: z.number().int().positive()}).strict().nullable(),
}).strict().refine(value => value.paused ? value.courseSelections.length === 0 : value.courseSelections.length > 0)
