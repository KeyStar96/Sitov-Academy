import { profileContactSchema } from '@/lib/types/profile'
import { profileRoleSchema } from '@/lib/types/backend'
import { saveNextMonthSchema, targetMonthSchema } from '@/lib/types/monthly-bookings'

const course = '00000000-0000-4000-8000-000000000001'

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
  it.each([true,false,undefined])('accepts an independent recording choice: %s',recordingAccepted=>{
    const fields={targetMonth:'2026-10-01',courseSelections:[{courseId:course}],paused:false,expected:null,recordingAccepted}
    expect(saveNextMonthSchema.parse(fields).recordingAccepted).toBe(recordingAccepted)
  })
  it.each(['true',1,null])('does not coerce a recording choice into consent: %s',recordingAccepted=>{
    expect(saveNextMonthSchema.safeParse({targetMonth:'2026-10-01',courseSelections:[{courseId:course}],paused:false,expected:null,recordingAccepted}).success).toBe(false)
  })
  it.each(['de','en','ru','uk','tr',undefined])('preserves the displayed notice locale: %s',locale=>{
    expect(saveNextMonthSchema.parse({targetMonth:'2026-10-01',courseSelections:[{courseId:course}],paused:false,expected:null,locale}).locale).toBe(locale)
  })
  it.each(['fr','EN',' en ',null,1,{},[]])('rejects unsupported or coerced notice locale: %j',locale=>{
    expect(saveNextMonthSchema.safeParse({targetMonth:'2026-10-01',courseSelections:[{courseId:course}],paused:false,expected:null,locale}).success).toBe(false)
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
