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

export function pickCanonicalNote(notes: TeacherStudentNote[]): TeacherStudentNote | null {
  if (notes.length === 0) return null
  return [...notes].sort((left, right) => left.id.localeCompare(right.id))[0]
}

export function notesByStudent(notes: TeacherStudentNote[]): Record<string, TeacherStudentNote> {
  const grouped = new Map<string, TeacherStudentNote[]>()
  for (const note of notes) {
    const list = grouped.get(note.student_id) ?? []
    list.push(note)
    grouped.set(note.student_id, list)
  }
  const result: Record<string, TeacherStudentNote> = {}
  for (const [studentId, list] of grouped) {
    const canonical = pickCanonicalNote(list)
    if (canonical) result[studentId] = canonical
  }
  return result
}

export function bookingForMonth(
  bookings: MonthlyCourseBooking[], userId: string, month: string,
): MonthlyCourseBooking | null {
  return bookings.find(booking => booking.user_id === userId && booking.target_month === month) ?? null
}

export function latestBookingBefore(
  bookings: MonthlyCourseBooking[], userId: string, nextMonth: string,
): MonthlyCourseBooking | null {
  const candidates = bookings
    .filter(booking => booking.user_id === userId && booking.target_month < nextMonth)
    .sort((left, right) => right.target_month.localeCompare(left.target_month) || left.id.localeCompare(right.id))
  return candidates[0] ?? null
}

export type EffectiveSelection =
  | { kind: 'paused' }
  | { kind: 'enrolled'; courseIds: string[]; source: 'booking' | 'previous'; status: NextMonthStudentRow['status'] }
  | { kind: 'none' }

export function effectiveNextMonthSelection(
  next: MonthlyCourseBooking | null,
  previous: MonthlyCourseBooking | null,
  catalog: CatalogCourse[],
  months: { next: string; afterNext: string },
): EffectiveSelection {
  const known = (id: string) => catalog.some(course => course.bookingId === id)
  if (next) {
    if (next.status === 'cancelled') return { kind: 'paused' }
    return {
      kind: 'enrolled',
      courseIds: next.course_ids.filter(known),
      source: 'booking',
      status: next.status === 'confirmed' ? 'confirmed' : 'pending',
    }
  }
  if (previous && previous.status !== 'cancelled') {
    const courseIds = previous.course_ids.filter(id => catalog.some(course =>
      course.bookingId === id && isCourseAvailableInNextMonth(course, months.next, months.afterNext)))
    if (courseIds.length === 0) return { kind: 'none' }
    return { kind: 'enrolled', courseIds, source: 'previous', status: 'inherited' }
  }
  return { kind: 'none' }
}

function studentName(student: StaffStudentContact): string {
  return (student.name ?? student.email).toLocaleLowerCase('de')
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
    groups.set(course.bookingId, {
      courseId: course.bookingId, title: course.title, translationKey: course.translationKey,
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
      student, courseIds: selection.kind === 'enrolled' ? selection.courseIds : [],
      source: selection.kind === 'enrolled' ? selection.source : 'booking',
      status: selection.kind === 'paused' ? 'cancelled' : selection.status,
      note: input.notes[student.id] ?? null,
    }
    if (selection.kind === 'paused') {
      paused.push(row)
      continue
    }
    enrolledIds.add(student.id)
    for (const courseId of selection.courseIds) {
      const existing = groups.get(courseId)
      if (existing) {
        existing.students.push(row)
        continue
      }
      groups.set(courseId, {
        courseId, title: null, translationKey: '', type: 'presence', students: [row],
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
