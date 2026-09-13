import type { Profile, Person } from './profile'
import type { CourseSelection } from '@/lib/course-selection'
import type { MonthlyBookingStatus } from './monthly-bookings'
import type { TeacherStudentNote } from './teacher-notes'

import type { TrainerAccessRule } from '@/lib/access/levels'

export interface AdminStudentRow extends Pick<Profile, 'id' | 'role' | 'created_at' | 'person'> {
  trainer_grants?: TrainerAccessRule[] | null
  allowed_levels: string[] | null
}

export interface CatalogCourse {
  id: string
  title: string | null
  type: 'online' | 'presence'
  startDate: string | null
  endDate: string | null
}

export interface StaffStudentContact {
  id: string
  person: Pick<Person, 'display_name' | 'email' | 'phone' | 'street' | 'postal_code' | 'city'> | null
}

export type NextMonthRowStatus = MonthlyBookingStatus | 'inherited'

export interface NextMonthStudentRow {
  student: StaffStudentContact
  courseSelections: CourseSelection[]
  source: 'booking' | 'previous'
  status: NextMonthRowStatus
  note: TeacherStudentNote | null
}

export interface NextMonthCourseGroup {
  courseId: string
  title: string | null
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
  const cityLine = [student.person?.postal_code, student.person?.city].filter(Boolean).join(' ').trim()
  const line = [student.person?.street, cityLine].filter(value => value && value.length > 0).join(', ')
  return line.length > 0 ? line : null
}
