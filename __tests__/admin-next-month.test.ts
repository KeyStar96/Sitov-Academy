import type { MonthlyCourseBooking } from '@/lib/types/monthly-bookings'
import type { CatalogCourse, StaffStudentContact } from '@/lib/types/admin-staff'
import type { TeacherStudentNote } from '@/lib/types/teacher-notes'
import {
  buildNextMonthOverview, effectiveNextMonthSelection, notesByStudent, pickCanonicalNote,
} from '@/lib/admin-next-month'
import { parseDiscountInput } from '@/lib/types/teacher-notes'
import {
  BLACKBOARD_EMPTY_NOTE, displayBlackboardNote, isEmptyBlackboard, saveBlackboardSchema,
  storedBlackboardNote,
} from '@/lib/types/teacher-notes'

const studentA = '00000000-0000-4000-8000-000000000001'
const studentB = '00000000-0000-4000-8000-000000000002'
const courseA = '00000000-0000-4000-8000-0000000000aa'
const courseB = '00000000-0000-4000-8000-0000000000bb'
const next = '2026-10-01'
const afterNext = '2026-11-01'

const catalog: CatalogCourse[] = [
  { bookingId: courseA, title: 'B1.2 Intensiv', translationKey: 'b12', type: 'presence', startDate: null, endDate: null },
  { bookingId: courseB, title: 'A1.1 Online', translationKey: 'a11', type: 'online', startDate: null, endDate: null },
]
const anna: StaffStudentContact = {
  id: studentA, name: 'Anna', email: 'anna@example.invalid', phone: '+49 111', street: 'Weg 1', zip_code: '30159', city: 'Hannover',
}
const boris: StaffStudentContact = {
  id: studentB, name: 'Boris', email: 'boris@example.invalid', phone: null, street: null, zip_code: null, city: null,
}

function booking(user: string, month: string, courses: string[], status: MonthlyCourseBooking['status'] = 'pending'): MonthlyCourseBooking {
  return { id: `${user}-${month}`, user_id: user, target_month: month, course_ids: courses, status }
}

describe('next-month grouping', () => {
  it('groups enrolled students strictly by course title such as B1.2 Intensiv', () => {
    const overview = buildNextMonthOverview({
      targetMonth: next, afterNext, students: [anna, boris],
      bookings: [booking(studentA, next, [courseA, courseB]), booking(studentB, next, [courseA])],
      catalog, notes: {},
    })
    expect(overview.groups.map(group => group.title)).toEqual(['A1.1 Online', 'B1.2 Intensiv'])
    const intensiv = overview.groups.find(group => group.title === 'B1.2 Intensiv')
    expect(intensiv?.students.map(row => row.student.name)).toEqual(['Anna', 'Boris'])
    expect(overview.enrolledCount).toBe(2)
  })
  it('inherits the previous month unless the student paused or changed it', () => {
    const selection = effectiveNextMonthSelection(
      null, booking(studentA, '2026-09-01', [courseA], 'confirmed'), catalog, { next, afterNext },
    )
    expect(selection).toEqual({ kind: 'enrolled', courseIds: [courseA], source: 'previous', status: 'inherited' })
    expect(effectiveNextMonthSelection(
      booking(studentA, next, [courseA], 'cancelled'), booking(studentA, '2026-09-01', [courseA]), catalog, { next, afterNext },
    )).toEqual({ kind: 'paused' })
  })
  it('does not inherit expired courses from the previous month', () => {
    const expired: CatalogCourse[] = [{ ...catalog[0], endDate: '2026-09-30' }]
    expect(effectiveNextMonthSelection(
      null, booking(studentA, '2026-09-01', [courseA]), expired, { next, afterNext },
    )).toEqual({ kind: 'none' })
  })
  it('lists paused students separately and keeps one canonical note per student', () => {
    const older: TeacherStudentNote = { id: 'a', student_id: studentA, teacher_id: studentB, note_text: 'alt', discount_percent: 0 }
    const newer: TeacherStudentNote = { id: 'b', student_id: studentA, teacher_id: studentB, note_text: 'neu', discount_percent: 10 }
    expect(pickCanonicalNote([newer, older])?.id).toBe('a')
    expect(notesByStudent([older, newer])[studentA].note_text).toBe('alt')
    const overview = buildNextMonthOverview({
      targetMonth: next, afterNext, students: [anna],
      bookings: [booking(studentA, next, [courseA], 'cancelled')],
      catalog, notes: { [studentA]: older },
    })
    expect(overview.groups).toEqual([])
    expect(overview.paused[0]?.note?.note_text).toBe('alt')
  })
})

describe('blackboard persistence helpers', () => {
  it('stores an invisible placeholder when only a discount is set', () => {
    expect(storedBlackboardNote('')).toBe(BLACKBOARD_EMPTY_NOTE)
    expect(displayBlackboardNote(BLACKBOARD_EMPTY_NOTE)).toBe('')
    expect(isEmptyBlackboard('', 0)).toBe(true)
    expect(isEmptyBlackboard('', 10)).toBe(false)
    expect(saveBlackboardSchema.parse({
      student_id: studentA, note_id: null, note_text: '  Hallo\r\n  ', discount_percent: 12.5,
    })).toEqual({ student_id: studentA, note_id: null, note_text: 'Hallo', discount_percent: 12.5 })
  })
  it('parses European decimal discounts and rejects out-of-range values', () => {
    expect(parseDiscountInput('10,5')).toBe(10.5)
    expect(parseDiscountInput('')).toBe(0)
    expect(parseDiscountInput('101')).toBeNull()
    expect(parseDiscountInput('1.234')).toBeNull()
  })
})
