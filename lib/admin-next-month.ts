import type { CourseSelection } from '@/lib/course-selection'
import type { MonthlyCourseBooking } from '@/lib/types/monthly-bookings'
import type { TeacherStudentNote } from '@/lib/types/teacher-notes'
import type {
  CatalogCourse, NextMonthCourseGroup, NextMonthOverview, NextMonthStudentRow, StaffStudentContact,
} from '@/lib/types/admin-staff'

export function isCourseAvailableInNextMonth(
  course: CatalogCourse, nextMonth: string, afterNext: string,
): boolean {
  return (!course.startDate || course.startDate < afterNext)
    && (!course.endDate || course.endDate >= nextMonth)
}

export function notesByStudent(notes: TeacherStudentNote[]): Record<string, TeacherStudentNote> {
  return Object.fromEntries(notes.map(note => [note.student_id, note]))
}

export function bookingForMonth(
  bookings: MonthlyCourseBooking[], userId: string, month: string,
): MonthlyCourseBooking | null {
  return bookings.find(booking => booking.userId === userId && booking.targetMonth === month) ?? null
}

export function latestBookingBefore(
  bookings: MonthlyCourseBooking[], userId: string, nextMonth: string,
): MonthlyCourseBooking | null {
  const candidates = bookings
    .filter(booking => booking.userId === userId && booking.targetMonth < nextMonth)
    .sort((left, right) => right.targetMonth.localeCompare(left.targetMonth) || left.id.localeCompare(right.id))
  return candidates[0] ?? null
}

export type EffectiveSelection =
  | { kind: 'paused' }
  | { kind: 'enrolled'; courseSelections: CourseSelection[]; source: 'booking' | 'previous'; status: NextMonthStudentRow['status'] }
  | { kind: 'none' }

export function effectiveNextMonthSelection(
  next: MonthlyCourseBooking | null,
  previous: MonthlyCourseBooking | null,
  catalog: CatalogCourse[],
  months: { next: string; afterNext: string },
): EffectiveSelection {
  const known = (id: string) => catalog.some(course => course.id === id)
  if (next) {
    if (next.status === 'cancelled') return { kind: 'paused' }
    return {
      kind: 'enrolled',
      courseSelections: next.courseSelections.filter(selection=>known(selection.courseId)),
      source: 'booking',
      status: next.status === 'confirmed' ? 'confirmed' : 'pending',
    }
  }
  if (previous && previous.status !== 'cancelled') {
    const courseSelections = previous.courseSelections.filter(selection => catalog.some(course =>
      course.id === selection.courseId && isCourseAvailableInNextMonth(course, months.next, months.afterNext)))
    if (courseSelections.length === 0) return { kind: 'none' }
    return { kind: 'enrolled', courseSelections, source: 'previous', status: 'inherited' }
  }
  return { kind: 'none' }
}

function studentName(student: StaffStudentContact): string {
  return (student.person?.display_name ?? student.person?.email ?? '').toLocaleLowerCase('de')
}

export function buildNextMonthOverview(input: {
  targetMonth: string
  afterNext: string
  students: StaffStudentContact[]
  bookings: MonthlyCourseBooking[]
  catalog: CatalogCourse[]
  notes: Record<string, TeacherStudentNote>
}): NextMonthOverview {
  const months = { next: input.targetMonth, afterNext: input.afterNext }
  const groups = new Map<string, NextMonthCourseGroup>()
  const paused: NextMonthStudentRow[] = []
  const enrolledIds = new Set<string>()
  for (const course of input.catalog) {
    groups.set(course.id, {
      courseId: course.id, title: course.title,
      type: course.type, students: [],
    })
  }
  for (const student of input.students) {
    const selection = effectiveNextMonthSelection(
      bookingForMonth(input.bookings, student.id, input.targetMonth),
      latestBookingBefore(input.bookings, student.id, input.targetMonth),
      input.catalog, months,
    )
    if (selection.kind === 'none') continue
    const row: NextMonthStudentRow = {
      student, courseSelections: selection.kind === 'enrolled' ? selection.courseSelections : [],
      source: selection.kind === 'enrolled' ? selection.source : 'booking',
      status: selection.kind === 'paused' ? 'cancelled' : selection.status,
      note: input.notes[student.id] ?? null,
    }
    if (selection.kind === 'paused') {
      paused.push(row)
      continue
    }
    enrolledIds.add(student.id)
    for (const {courseId} of selection.courseSelections) {
      const existing = groups.get(courseId)
      if (existing) {
        existing.students.push(row)
        continue
      }
      groups.set(courseId, {
        courseId, title: null, type: 'presence', students: [row],
      })
    }
  }
  const sortedGroups = [...groups.values()]
    .filter(group => group.students.length > 0)
    .map(group => ({
      ...group,
      students: [...group.students].sort((left, right) => studentName(left.student).localeCompare(studentName(right.student), 'de')),
    }))
    .sort((left, right) => (left.title ?? left.courseId).localeCompare(right.title ?? right.courseId, 'de'))
  paused.sort((left, right) => studentName(left.student).localeCompare(studentName(right.student), 'de'))
  return {
    targetMonth: input.targetMonth,
    groups: sortedGroups,
    paused,
    enrolledCount: enrolledIds.size,
  }
}
