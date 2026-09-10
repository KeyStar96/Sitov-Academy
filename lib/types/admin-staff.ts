import type { MonthlyBookingStatus } from './monthly-bookings'
import type { TeacherStudentNote } from './teacher-notes'

import type { TrainerAccessRule } from '@/lib/access/levels'

export interface AdminStudentRow {
  student_trainer_access?: TrainerAccessRule[] | null
  id: string
  name: string | null
  email: string
  role: string | null
  allowed_levels: string[] | null
  created_at: string | null
  phone: string | null
  street: string | null
  zip_code: string | null
  city: string | null
}

export interface CatalogCourse {
  bookingId: string
  title: string | null
  translationKey: string
  type: 'online' | 'presence'
  startDate: string | null
  endDate: string | null
}

export interface StaffStudentContact {
  id: string
  name: string | null
  email: string
  phone: string | null
  street: string | null
  zip_code: string | null
  city: string | null
}

export type NextMonthRowStatus = MonthlyBookingStatus | 'inherited'

export interface NextMonthStudentRow {
  student: StaffStudentContact
  courseIds: string[]
  source: 'booking' | 'previous'
  status: NextMonthRowStatus
  note: TeacherStudentNote | null
}

export interface NextMonthCourseGroup {
  courseId: string
  title: string | null
  translationKey: string
  type: 'online' | 'presence'
  students: NextMonthStudentRow[]
}

export interface NextMonthOverview {
  targetMonth: string
  groups: NextMonthCourseGroup[]
  paused: NextMonthStudentRow[]
  enrolledCount: number
}

export function formatStudentAddress(student: StaffStudentContact): string | null {
  const cityLine = [student.zip_code, student.city].filter(Boolean).join(' ').trim()
  const line = [student.street, cityLine].filter(value => value && value.length > 0).join(', ')
  return line.length > 0 ? line : null
}
