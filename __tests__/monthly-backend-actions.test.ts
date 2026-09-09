jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createMonthlyBooking, updateMonthlyBooking, deleteMonthlyBooking } from '@/app/actions/monthly-bookings'
import { createTeacherNote, getTeacherNotes, updateTeacherNote } from '@/app/actions/teacher-notes'
import { updateStudentRole } from '@/app/actions/admin'
import { updateProfileContact } from '@/app/actions/profile'
import { revalidatePath } from 'next/cache'

const uid = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const course = '00000000-0000-4000-8000-000000000003'
const bookingInput = { target_month: '2026-10-01', course_ids: [course] }
const row = { id: other, user_id: uid, ...bookingInput, status: 'pending' }

function session(role: string | null = 'student', signedIn = true, queryError: { code: string; message?: string } | null = null) {
  const chain = {
    select: jest.fn().mockReturnThis(), insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(), delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({ data: [], error: queryError }),
    single: jest.fn().mockResolvedValue({ data: queryError ? null : row, error: queryError }),
  }
  const profileChain = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { role }, error: null }) }
  const from = jest.fn((table: string) => table === 'profiles' ? profileChain : chain)
  const client = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: signedIn ? { id: uid } : null }, error: null }) }, from }
  // The fake is deliberately narrow; production queries use Database generics.
  jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  return { chain, from, client, profileChain }
}

beforeEach(() => jest.clearAllMocks())

describe('monthly backend action authorization', () => {
  it('rejects a missing session before accessing tables', async () => {
    const { from } = session('student', false)
    expect(await createMonthlyBooking(bookingInput)).toEqual({ success: false, error: 'not_authenticated' })
    expect(from).not.toHaveBeenCalled()
  })
  it.each(['student', null])('denies note reads to %s', async role => {
    const { from } = session(role)
    expect(await getTeacherNotes()).toEqual({ success: false, error: 'not_authorized' })
    expect(from).not.toHaveBeenCalledWith('teacher_student_notes')
  })
  it('takes the booking owner from the validated session', async () => {
    const { chain } = session()
    expect(await createMonthlyBooking(bookingInput)).toEqual({ success: true, data: row })
    expect(chain.insert).toHaveBeenCalledWith({ ...bookingInput, user_id: uid, status: 'pending' })
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/[lang]/dashboard', 'layout')
  })
  it('rejects a forged owner and self-confirmation', async () => {
    const { chain } = session()
    expect(await createMonthlyBooking({ ...bookingInput, user_id: other })).toEqual({ success: false, error: 'not_authorized' })
    expect(await updateMonthlyBooking({ id: other, status: 'confirmed' })).toEqual({ success: false, error: 'not_authorized' })
    expect(chain.insert).not.toHaveBeenCalled()
    expect(chain.update).not.toHaveBeenCalled()
  })
  it('allows an admin to book for another profile with the RLS client', async () => {
    const { chain } = session('admin')
    await createMonthlyBooking({ ...bookingInput, user_id: other })
    expect(chain.insert).toHaveBeenCalledWith({ ...bookingInput, user_id: other, status: 'pending' })
    expect(createAdminClient).not.toHaveBeenCalled()
  })
  it('reports an invisible/missing mutation target as failure', async () => {
    const { chain } = session('student', true, { code: 'PGRST116', message: 'Private data' })
    expect(await deleteMonthlyBooking(other)).toEqual({ success: false, error: 'not_found' })
    expect(chain.eq).toHaveBeenCalledWith('user_id', uid)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it('does not leak raw DB errors', async () => {
    session('student', true, { code: '23505', message: 'Private email and SQL detail' })
    expect(await createMonthlyBooking(bookingInput)).toEqual({ success: false, error: 'conflict' })
  })
  it('derives note author from session and sanitizes text', async () => {
    const { chain } = session('teacher')
    await createTeacherNote({ student_id: other, note_text: '  Hallo\r\nWelt  ', discount_percent: 12.5 })
    expect(chain.insert).toHaveBeenCalledWith({ student_id: other, teacher_id: uid, note_text: 'Hallo\nWelt', discount_percent: 12.5 })
  })
  it('rejects unsafe note updates before querying notes', async () => {
    const { chain } = session('teacher')
    expect(await updateTeacherNote({ id: other, note_text: '<script>x</script>' })).toEqual({ success: false, error: 'invalid_input' })
    expect(chain.update).not.toHaveBeenCalled()
  })
  it('prevents teacher self-promotion via the existing service-role action', async () => {
    session('teacher')
    expect(await updateStudentRole(uid, 'admin')).toEqual({ success: false, error: 'not_authorized' })
    expect(createAdminClient).not.toHaveBeenCalled()
  })
  it('validates role before creating the privileged client', async () => {
    session('admin')
    expect(await updateStudentRole(other, 'superadmin')).toEqual({ success: false, error: 'invalid_input' })
    expect(createAdminClient).not.toHaveBeenCalled()
  })
  it('rejects address role injection before any update', async () => {
    session()
    expect(await updateProfileContact({ phone: null, street: null, zip_code: null, city: null, role: 'admin' })).toEqual({ success: false, error: 'invalid_input' })
  })
})
