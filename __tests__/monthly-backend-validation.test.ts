import { profileContactSchema } from '@/lib/types/profile'
import { profileRoleSchema } from '@/lib/types/backend'
import { saveNextMonthSchema, targetMonthSchema } from '@/lib/types/monthly-bookings'
import { saveBlackboardSchema } from '@/lib/types/teacher-notes'

const course = '00000000-0000-4000-8000-000000000001'
const note = { student_id: course, note_id: null, note_text: ' Notiz\r\nmit Umlauten: ä, ї, ı ' }

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
    expect(saveNextMonthSchema.safeParse({ targetMonth: '2026-09-01', courseSelections: value.map(courseId=>({courseId})), paused:false, expected:null }).success).toBe(false)
  })
  it('rejects case-only duplicate UUIDs after normalization', () => {
    const mixed = 'a0000000-0000-4000-8000-000000000001'
    expect(saveNextMonthSchema.safeParse({ targetMonth: '2026-09-01', courseSelections: [{courseId:mixed},{courseId:mixed.toUpperCase()}], paused:false, expected:null }).success).toBe(false)
  })
  it('rejects forged status and immutable update fields', () => {
    expect(saveNextMonthSchema.safeParse({ targetMonth: '2026-09-01', courseSelections: [{courseId:course}], paused:false, expected:null, status: 'confirmed' }).success).toBe(false)
    for (const field of ['user_id','auth_user_id']) {
      expect(saveNextMonthSchema.safeParse({ targetMonth:'2026-09-01',courseSelections:[],paused:true,expected:null,[field]:course }).success).toBe(false)
    }
    expect(saveNextMonthSchema.safeParse({ id: course }).success).toBe(false)
  })
  it('normalizes note line endings and preserves canonical empty notes', () => {
    expect(saveBlackboardSchema.parse(note)).toEqual({ student_id: course, note_id: null, note_text: 'Notiz\nmit Umlauten: ä, ї, ı' })
    expect(saveBlackboardSchema.parse({ ...note, note_text: '   ' }).note_text).toBe('')
  })
  it.each(['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', 'Hidden\u0000text', 'x'.repeat(5001)])('rejects unsafe note text', value => {
    expect(saveBlackboardSchema.safeParse({ ...note, note_text: value }).success).toBe(false)
  })
  it('rejects forged teacher or obsolete billing metadata', () => {
    expect(saveBlackboardSchema.safeParse({ ...note, teacher_id: course }).success).toBe(false)
    expect(saveBlackboardSchema.safeParse({ ...note, discount_percent: 10 }).success).toBe(false)
    expect(saveBlackboardSchema.safeParse({ ...note, is_blackboard: true }).success).toBe(false)
  })
  it('preserves international addresses and leading postal zeroes', () => {
    expect(profileContactSchema.parse({ phone: ' +49 123 ', street: ' Straße 2 ', postal_code: '00123', city: 'Київ' })).toEqual({ phone: '+49 123', street: 'Straße 2', postal_code: '00123', city: 'Київ' })
    expect(profileContactSchema.parse({ phone: null, street: null, postal_code: null, city: null }).phone).toBeNull()
  })
  it('rejects contact markup, multiline addresses, and privilege mass assignment', () => {
    const contact = { phone: null, street: 'Straße 2', postal_code: '00123', city: 'Berlin' }
    expect(profileContactSchema.safeParse({ ...contact, city: '<b>Berlin</b>' }).success).toBe(false)
    expect(profileContactSchema.safeParse({ ...contact, street: 'One\nTwo' }).success).toBe(false)
    expect(profileContactSchema.safeParse({ ...contact, role: 'admin' }).success).toBe(false)
  })
})
