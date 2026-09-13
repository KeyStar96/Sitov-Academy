import type { MonthlyCourseBooking } from '@/lib/types/monthly-bookings'
import type { CatalogCourse, StaffStudentContact } from '@/lib/types/admin-staff'
import type { TeacherStudentNote } from '@/lib/types/teacher-notes'
import {
  buildNextMonthOverview, effectiveNextMonthSelection, notesByStudent,
} from '@/lib/admin-next-month'
const studentA = '00000000-0000-4000-8000-000000000001'
const studentB = '00000000-0000-4000-8000-000000000002'
const courseA = '00000000-0000-4000-8000-0000000000aa'
const courseB = '00000000-0000-4000-8000-0000000000bb'
const next = '2026-10-01'
const afterNext = '2026-11-01'

const catalog: CatalogCourse[] = [
  { id: courseA, title: 'B1.2 Intensiv', type: 'presence', startDate: null, endDate: null },
  { id: courseB, title: 'A1.1 Online', type: 'online', startDate: null, endDate: null },
]
const anna: StaffStudentContact = {
  id: studentA, person:{display_name: 'Anna', email: 'anna@example.invalid', phone: '+49 111', street: 'Weg 1', postal_code: '30159', city: 'Hannover'},
}
const boris: StaffStudentContact = {
  id: studentB, person:{display_name: 'Boris', email: 'boris@example.invalid', phone: null, street: null, postal_code: null, city: null},
}

function booking(user: string, month: string, courses: string[], status: MonthlyCourseBooking['status'] = 'pending'): MonthlyCourseBooking {
  return { id: `${user}-${month}`, userId: user, targetMonth: month, courseSelections: courses.map(courseId=>({courseId})), status,revision:1 }
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
    expect(intensiv?.students.map(row => row.student.person?.display_name)).toEqual(['Anna', 'Boris'])
    expect(overview.enrolledCount).toBe(2)
  })
  it('inherits the previous month unless the student paused or changed it', () => {
    const selection = effectiveNextMonthSelection(
      null, booking(studentA, '2026-09-01', [courseA], 'confirmed'), catalog, { next, afterNext },
    )
    expect(selection).toEqual({ kind: 'enrolled', courseSelections: [{courseId:courseA}], source: 'previous', status: 'inherited' })
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
  it('lists paused students separately and associates the unique central note', () => {
    const note: TeacherStudentNote = {id:'note',student_id:studentA,teacher_id:studentB,note_text:'Bitte melden',created_at:'2026-09-01',updated_at:'2026-09-01'}
    expect(notesByStudent([note])[studentA]).toBe(note)
    const overview=buildNextMonthOverview({targetMonth:next,afterNext,students:[anna],bookings:[booking(studentA,next,[courseA],'cancelled')],catalog,notes:notesByStudent([note])})
    expect(overview.groups).toEqual([])
    expect(overview.paused[0]?.note).toBe(note)
  })
})
