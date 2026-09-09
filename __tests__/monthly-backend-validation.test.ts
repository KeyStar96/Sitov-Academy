import { profileContactSchema } from '@/lib/types/profile'
import { profileRoleSchema } from '@/lib/types/backend'
import { createMonthlyBookingSchema, updateMonthlyBookingSchema, targetMonthSchema } from '@/lib/types/monthly-bookings'
import { createTeacherNoteSchema, updateTeacherNoteSchema } from '@/lib/types/teacher-notes'

const course = '00000000-0000-4000-8000-000000000001'
const note = { student_id: course, note_text: ' Notiz\r\nmit Umlauten: ä, ї, ı ' }

describe('monthly backend validation', () => {
  it('accepts all supported roles, rejecting invented privileges', () => {
    for (const role of ['student', 'teacher', 'admin']) expect(profileRoleSchema.safeParse(role).success).toBe(true)
    expect(profileRoleSchema.safeParse('superadmin').success).toBe(false)
  })
  it.each(['2026-09', '2026-09-02', '2026-00-01', '2026-13-01', '0000-01-01', '2026-09-01T00:00:00Z'])('rejects invalid month %s', value => {
    expect(targetMonthSchema.safeParse(value).success).toBe(false)
  })
  it('keeps first-of-month date strings without UTC conversion', () => {
    expect(targetMonthSchema.parse('2026-09-01')).toBe('2026-09-01')
  })
  it.each([[], ['legacy-text-id'], [course, course], [null], Array(101).fill(course)].map(value => [value]))('rejects invalid course array %j', value => {
    expect(createMonthlyBookingSchema.safeParse({ target_month: '2026-09-01', course_ids: value }).success).toBe(false)
  })
  it('rejects case-only duplicate UUIDs after normalization', () => {
    const mixed = 'a0000000-0000-4000-8000-000000000001'
    expect(createMonthlyBookingSchema.safeParse({ target_month: '2026-09-01', course_ids: [mixed, mixed.toUpperCase()] }).success).toBe(false)
  })
  it('rejects forged status and immutable update fields', () => {
    expect(createMonthlyBookingSchema.safeParse({ target_month: '2026-09-01', course_ids: [course], status: 'confirmed' }).success).toBe(false)
    expect(updateMonthlyBookingSchema.safeParse({ id: course, user_id: course, status: 'pending' }).success).toBe(false)
    expect(updateMonthlyBookingSchema.safeParse({ id: course }).success).toBe(false)
  })
  it('normalizes note line endings and whitespace; defaults discount to zero', () => {
    expect(createTeacherNoteSchema.parse(note)).toEqual({ student_id: course, note_text: 'Notiz\nmit Umlauten: ä, ї, ı', discount_percent: 0 })
  })
  it.each(['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', 'Hidden\u0000text', '   ', 'x'.repeat(5001)])('rejects unsafe or invalid note text', value => {
    expect(createTeacherNoteSchema.safeParse({ ...note, note_text: value }).success).toBe(false)
  })
  it.each([-1, 101, 0.001, Infinity, NaN, '10'])('rejects invalid discount %s', value => {
    expect(createTeacherNoteSchema.safeParse({ ...note, discount_percent: value }).success).toBe(false)
  })
  it.each([0, 100, 12.5, 99.99])('accepts numeric discount %s', value => {
    expect(createTeacherNoteSchema.parse({ ...note, discount_percent: value }).discount_percent).toBe(value)
  })
  it('rejects forged teacher and student reassignment', () => {
    expect(createTeacherNoteSchema.safeParse({ ...note, teacher_id: course }).success).toBe(false)
    expect(updateTeacherNoteSchema.safeParse({ id: course, student_id: course, note_text: 'Updated' }).success).toBe(false)
  })
  it('preserves international addresses and leading postal zeroes', () => {
    expect(profileContactSchema.parse({ phone: ' +49 123 ', street: ' Straße 2 ', zip_code: '00123', city: 'Київ' })).toEqual({ phone: '+49 123', street: 'Straße 2', zip_code: '00123', city: 'Київ' })
    expect(profileContactSchema.parse({ phone: null, street: null, zip_code: null, city: null }).phone).toBeNull()
  })
  it('rejects contact markup, multiline addresses, and privilege mass assignment', () => {
    const contact = { phone: null, street: 'Straße 2', zip_code: '00123', city: 'Berlin' }
    expect(profileContactSchema.safeParse({ ...contact, city: '<b>Berlin</b>' }).success).toBe(false)
    expect(profileContactSchema.safeParse({ ...contact, street: 'One\nTwo' }).success).toBe(false)
    expect(profileContactSchema.safeParse({ ...contact, role: 'admin' }).success).toBe(false)
  })
})
