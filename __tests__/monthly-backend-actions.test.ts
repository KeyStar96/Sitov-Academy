jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { saveNextMonthBooking } from '@/app/actions/monthly-bookings'
import { createTeacherNote, getTeacherNotes, updateTeacherNote, saveBlackboardNote } from '@/app/actions/teacher-notes'
import { getNextMonthStaffOverview } from '@/app/actions/admin-operations'
import { updateStudentRole } from '@/app/actions/admin'
import { updateProfileContact } from '@/app/actions/profile'
import { revalidatePath } from 'next/cache'

const uid = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const course = '00000000-0000-4000-8000-000000000003'
const bookingInput = { targetMonth: '2026-10-01', courseIds: [course], paused:false, expected:null }
const row = { id: other, target_month:bookingInput.targetMonth,booking_items:[{course_id:course}], status: 'pending',revision:1 }

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
  const rpc = jest.fn().mockResolvedValue({ data: [], error: queryError })
  const client = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: signedIn ? { id: uid } : null }, error: null }) }, from, rpc }
  // The fake is deliberately narrow; production queries use Database generics.
  jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  return { chain, from, client, profileChain, rpc }
}

beforeEach(() => jest.clearAllMocks())

describe('monthly backend action authorization', () => {
  it('rejects a missing session before accessing tables', async () => {
    const { from } = session('student', false)
    expect(await saveNextMonthBooking(bookingInput)).toEqual({ success: false, error: 'not_authenticated' })
    expect(from).not.toHaveBeenCalled()
  })
  it.each(['student', null])('denies note reads to %s', async role => {
    const { from } = session(role)
    expect(await getTeacherNotes()).toEqual({ success: false, error: 'not_authorized' })
    expect(from).not.toHaveBeenCalledWith('teacher_student_notes')
  })
  it('derives ownership from the RPC session and reloads the acknowledged revision', async () => {
    const { chain,rpc } = session()
    rpc.mockResolvedValue({data:other,error:null})
    expect(await saveNextMonthBooking(bookingInput)).toEqual({success:true,data:{id:other,user_id:uid,target_month:bookingInput.targetMonth,course_ids:[course],status:'pending',revision:1}})
    expect(rpc).toHaveBeenCalledWith('save_business_month',{p_month:bookingInput.targetMonth,p_courses:[course],p_paused:false,p_expected:undefined,p_revision:undefined})
    expect(chain.insert).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/[lang]/dashboard','layout')
  })
  it('rejects forged ownership and status before sending a mutation',async()=>{
    const {rpc}=session()
    expect(await saveNextMonthBooking({...bookingInput,user_id:other})).toEqual({success:false,error:'invalid_input'})
    expect(await saveNextMonthBooking({...bookingInput,status:'confirmed'})).toEqual({success:false,error:'invalid_input'})
    expect(rpc).not.toHaveBeenCalled()
  })
  it.each(['40001','PT409'])('maps a stale monthly revision %s to a safe conflict',async code=>{
    const {rpc}=session()
    rpc.mockResolvedValue({data:null,error:{code,message:'Private data'}})
    expect(await saveNextMonthBooking(bookingInput)).toEqual({success:false,error:'conflict'})
  })
  it('reports invisible acknowledgement targets as failures',async()=>{
    const {rpc,chain}=session()
    rpc.mockResolvedValue({data:other,error:null});chain.single.mockResolvedValue({data:null,error:{code:'PGRST116'}})
    expect(await saveNextMonthBooking(bookingInput)).toEqual({success:false,error:'not_found'})
  })
  it('derives note author from session and sanitizes text', async () => {
    const { chain } = session('teacher')
    await createTeacherNote({ student_id: other, note_text: '  Hallo\r\nWelt  ', discount_percent: 12.5 })
    expect(chain.insert).toHaveBeenCalledWith({ student_id: other, teacher_id: uid, note_text: 'Hallo\nWelt', discount_percent: 12.5 })
  })
  it('saves through the canonical RPC without overwriting a hidden legacy discount', async () => {
    const { chain, rpc } = session('teacher')
    const saved = { id: other, student_id: other, teacher_id: uid, note_text: 'Notiz', discount_percent: 10, is_blackboard: true }
    rpc.mockResolvedValue({ data: [saved], error: null })
    expect(await saveBlackboardNote({ student_id: other, note_id: other, note_text: '  Notiz  ', discount_percent: 0 }))
      .toEqual({ success: true, data: saved })
    expect(rpc).toHaveBeenCalledWith('save_student_blackboard', {
      p_student_id: other, p_expected_note_id: other, p_note_text: 'Notiz',
    })
    expect(chain.insert).not.toHaveBeenCalled()
    expect(chain.update).not.toHaveBeenCalled()
  })
  it('does not insert an empty blackboard', async () => {
    const { chain, rpc } = session('teacher')
    expect(await saveBlackboardNote({ student_id: other, note_id: null, note_text: '', discount_percent: 0 }))
      .toEqual({ success: true, data: null })
    expect(chain.insert).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith('save_student_blackboard', { p_student_id: other, p_expected_note_id: null, p_note_text: '' })
  })
  it('keeps the canonical ID when clearing a board instead of deleting the row', async () => {
    const { chain, rpc } = session('teacher')
    const cleared = { id: other, student_id: other, teacher_id: uid, note_text: '\u2060', discount_percent: 0, is_blackboard: true }
    rpc.mockResolvedValue({ data: [cleared], error: null })
    expect(await saveBlackboardNote({ student_id: other, note_id: other, note_text: '', discount_percent: 0 }))
      .toEqual({ success: true, data: cleared })
    expect(chain.delete).not.toHaveBeenCalled()
  })
  it('reports a stale or foreign note ID as a safe conflict', async () => {
    const { rpc } = session('teacher')
    rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'Private note details' } })
    expect(await saveBlackboardNote({ student_id: other, note_id: course, note_text: 'Retain draft', discount_percent: 0 }))
      .toEqual({ success: false, error: 'conflict' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it('rejects student blackboard saves before making an RPC call', async () => {
    const { rpc } = session('student')
    expect(await saveBlackboardNote({ student_id: other, note_id: null, note_text: 'Forged', discount_percent: 0 }))
      .toEqual({ success: false, error: 'not_authorized' })
    expect(rpc).not.toHaveBeenCalled()
  })
  it('denies the next-month staff overview to students', async () => {
    session('student')
    expect(await getNextMonthStaffOverview()).toEqual({ success: false, error: 'not_authorized' })
    expect(createAdminClient).not.toHaveBeenCalled()
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
