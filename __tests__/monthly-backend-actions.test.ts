jest.mock('@/lib/profile-monthly-access', () => ({ hasConfirmedCourseRegistration: jest.fn().mockResolvedValue(true) }))
jest.mock('@/lib/profile-person', () => ({ resolveVerifiedPerson: jest.fn().mockResolvedValue({id:'trusted-person',unresolved:false}) }))
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { saveNextMonthBooking } from '@/app/actions/monthly-bookings'
import { getNextMonthStaffOverview } from '@/app/actions/admin-operations'
import { updateStudentRole } from '@/app/actions/admin'
import { updateProfileContact } from '@/app/actions/profile'
import { revalidatePath } from 'next/cache'
import { hasConfirmedCourseRegistration } from '@/lib/profile-monthly-access'

const uid = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const course = '00000000-0000-4000-8000-000000000003'
const bookingInput = { targetMonth: '2026-10-01', courseSelections: [{courseId:course}], paused:false, expected:null }
const row = { id: other, target_month:bookingInput.targetMonth,booking_items:[{course_id:course,requested_units:null}], status: 'pending',revision:1 }
const persistedCourse = (type='presence',category='german',id=course) => ({id,type,category,archived_at:null})
const courseLookup=jest.fn()
const courseQuery={select:jest.fn().mockReturnThis(),in:jest.fn().mockReturnThis(),is:courseLookup}
const adminFrom=jest.fn(()=>courseQuery)

function session(role: string | null = 'student', signedIn = true, queryError: { code: string; message?: string } | null = null) {
  const chain = {
    select: jest.fn().mockReturnThis(), insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(), delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({ data: [], error: queryError }),
    single: jest.fn().mockResolvedValue({ data: queryError ? null : row, error: queryError }),
  }
  const profileChain = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { role, ui_language: 'de' }, error: null }) }
  const from = jest.fn((table: string) => table === 'profiles' ? profileChain : chain)
  const rpc = jest.fn().mockResolvedValue({ data: [], error: queryError })
  const client = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: signedIn ? { id: uid } : null }, error: null }) }, from, rpc }
  // The fake is deliberately narrow; production queries use Database generics.
  jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  return { chain, from, client, profileChain, rpc }
}

beforeEach(() => {
  jest.clearAllMocks(); jest.mocked(hasConfirmedCourseRegistration).mockResolvedValue(true)
  courseLookup.mockResolvedValue({data:[persistedCourse()],error:null})
  jest.mocked(createAdminClient).mockReturnValue({from:adminFrom} as unknown as ReturnType<typeof createAdminClient>)
})

describe('monthly backend action authorization', () => {
  it('rejects an unconfirmed registration before calling the monthly mutation', async () => {
    const { rpc } = session()
    jest.mocked(hasConfirmedCourseRegistration).mockResolvedValue(false)
    expect(await saveNextMonthBooking(bookingInput)).toEqual({ success: false, error: 'not_authorized' })
    expect(rpc).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })
  it('rejects a missing session before accessing tables', async () => {
    const { from } = session('student', false)
    expect(await saveNextMonthBooking(bookingInput)).toEqual({ success: false, error: 'not_authenticated' })
    expect(from).not.toHaveBeenCalled()
  })
  it('derives ownership from the RPC session and reloads the acknowledged revision', async () => {
    const { chain,rpc } = session()
    rpc.mockResolvedValue({data:other,error:null})
    expect(await saveNextMonthBooking(bookingInput)).toEqual({success:true,data:{id:other,userId:uid,targetMonth:bookingInput.targetMonth,courseSelections:[{courseId:course}],status:'pending',revision:1}})
    expect(rpc).toHaveBeenCalledWith('sitov_save_business_month',{p_month:bookingInput.targetMonth,p_course_selections:[{course_id:course}],p_paused:false,p_expected:undefined,p_revision:undefined,p_recording_accepted:null,p_locale:null})
    expect(chain.insert).not.toHaveBeenCalled()
    expect(createAdminClient).toHaveBeenCalledTimes(1)
    expect(adminFrom).toHaveBeenCalledWith('courses')
    expect(revalidatePath).toHaveBeenCalledWith('/[lang]/dashboard','layout')
  })
  it('rejects forged ownership and status before sending a mutation',async()=>{
    const {rpc}=session()
    for (const field of ['user_id','auth_user_id']) {
      expect(await saveNextMonthBooking({...bookingInput,[field]:other})).toEqual({success:false,error:'invalid_input'})
    }
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
  it('rejects JSON errors before reloading a booking', async () => {
    const { rpc, chain } = session('teacher')
    rpc.mockResolvedValue({ data: { error: 'conflict', message: 'Reload and retry the request.', sqlstate: '40001' }, error: null })
    expect(await saveNextMonthBooking(bookingInput)).toEqual({ success: false, error: 'conflict' })
    expect(chain.single).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it('denies the next-month staff overview to students', async () => {
    session('student')
    expect(await getNextMonthStaffOverview()).toEqual({ success: false, error: 'not_authorized' })
    expect(createAdminClient).not.toHaveBeenCalled()
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
    expect(await updateProfileContact({ phone: null, street: null, postal_code: null, city: null, role: 'admin' })).toEqual({ success: false, error: 'invalid_input' })
  })
})

describe('monthly recording consent uses authoritative course records',()=>{
  it.each(['german','speaking','online'])('requires true for an online %s group before the new RPC',async category=>{
    const {rpc}=session();rpc.mockResolvedValue({data:other,error:null})
    courseLookup.mockResolvedValue({data:[persistedCourse('online',category)],error:null})
    for(const recordingAccepted of [false,undefined])expect(await saveNextMonthBooking({...bookingInput,recordingAccepted})).toEqual({success:false,error:'invalid_input'})
    expect(rpc).not.toHaveBeenCalled()
    expect((await saveNextMonthBooking({...bookingInput,recordingAccepted:true,expected:{id:other,revision:3}})).success).toBe(true)
    expect(rpc).toHaveBeenCalledWith('sitov_save_business_month',{
      p_month:bookingInput.targetMonth,p_course_selections:[{course_id:course}],p_paused:false,p_expected:other,p_revision:3,p_recording_accepted:true,p_locale:null,
    })
    expect(courseQuery.select).toHaveBeenCalledWith('id,type,category,archived_at')
    expect(courseQuery.in).toHaveBeenCalledWith('id',[course])
  })
  it.each([['online','private'],...['german','speaking','online','private'].map(category=>['presence',category])])('preserves false/unset choices for %s/%s',async(type,category)=>{
    const {rpc}=session();rpc.mockResolvedValue({data:other,error:null})
    courseLookup.mockResolvedValue({data:[persistedCourse(type,category)],error:null})
    for(const recordingAccepted of [false,undefined]){
      expect((await saveNextMonthBooking({...bookingInput,recordingAccepted})).success).toBe(true)
      expect(rpc).toHaveBeenLastCalledWith('sitov_save_business_month',expect.objectContaining({p_recording_accepted:recordingAccepted??null}))
    }
  })
  it('requires true for a mixed private/online-group selection',async()=>{
    const {rpc}=session();rpc.mockResolvedValue({data:other,error:null})
    courseLookup.mockResolvedValue({data:[persistedCourse('online','private'),persistedCourse('online','german',other)],error:null})
    const courseSelections=[{courseId:course,requestedUnits:2},{courseId:other}]
    expect(await saveNextMonthBooking({...bookingInput,courseSelections,recordingAccepted:false})).toEqual({success:false,error:'invalid_input'})
    expect(rpc).not.toHaveBeenCalled()
    expect((await saveNextMonthBooking({...bookingInput,courseSelections,recordingAccepted:true})).success).toBe(true)
  })
  it('passes the displayed English notice locale even when the saved profile language is Russian',async()=>{
    const {rpc,profileChain}=session();rpc.mockResolvedValue({data:other,error:null})
    profileChain.single.mockResolvedValue({data:{role:'student',ui_language:'ru'},error:null})
    courseLookup.mockResolvedValue({data:[persistedCourse('online','german')],error:null})
    expect((await saveNextMonthBooking({...bookingInput,recordingAccepted:true,locale:'en'})).success).toBe(true)
    expect(rpc).toHaveBeenCalledWith('sitov_save_business_month',expect.objectContaining({p_locale:'en',p_recording_accepted:true}))
  })
  it.each(['fr','EN',' en ',null,1])('rejects invalid displayed locale %s before course access or mutation',async locale=>{
    const {rpc}=session()
    expect(await saveNextMonthBooking({...bookingInput,recordingAccepted:true,locale})).toEqual({success:false,error:'invalid_input'})
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
  it.each([
    {data:null,error:{message:'private error'}},{data:[],error:null},
    {data:[persistedCourse('online','private',other)],error:null},
    {data:[persistedCourse(),persistedCourse()],error:null},
    {data:[{...persistedCourse(),archived_at:'2026-10-04T10:00:00Z'}],error:null},
    {data:[persistedCourse('unknown','private')],error:null},
    {data:[persistedCourse('online','unknown')],error:null},
  ])('never mutates when persisted courses cannot be verified: %#',async result=>{
    const {rpc}=session();courseLookup.mockResolvedValue(result)
    expect(await saveNextMonthBooking({...bookingInput,recordingAccepted:true})).toEqual({success:false,error:'request_failed'})
    expect(rpc).not.toHaveBeenCalled();expect(revalidatePath).not.toHaveBeenCalled()
  })
  it('does not create a privileged client or require recording for an empty pause',async()=>{
    const {rpc,chain}=session();rpc.mockResolvedValue({data:other,error:null});chain.single.mockResolvedValue({data:{...row,booking_items:[],status:'cancelled'},error:null})
    expect((await saveNextMonthBooking({...bookingInput,courseSelections:[],paused:true})).success).toBe(true)
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith('sitov_save_business_month',expect.objectContaining({p_course_selections:[],p_paused:true,p_recording_accepted:null}))
  })
})
