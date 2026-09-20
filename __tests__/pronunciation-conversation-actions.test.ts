/** @jest-environment node */
import { queueTransactionalEmail } from '@/lib/mail'
import { createPronunciationSubmission, getPronunciationConversations, sendPronunciationMessage } from '@/app/actions/pronunciation-conversations'

const owner = '6aab2f11-3456-4234-8234-123456789012'
const other = '7aab2f11-3456-4234-8234-123456789012'
const promptId = '3aab2f11-3456-4234-8234-123456789012'
const path = `storage://pronunciation_audio/${owner}/2aab2f11-3456-4234-8234-123456789012.webm`
const mockGetUser = jest.fn()
const mockRpc = jest.fn()
const mockFrom = jest.fn()
const mockSignedUrl = jest.fn()
const mockClient = { auth:{getUser:mockGetUser}, rpc:mockRpc, from:mockFrom, storage:{from:jest.fn(() => ({createSignedUrl:mockSignedUrl}))} }
jest.mock('server-only', () => ({}), {virtual:true})
jest.mock('@/utils/supabase/server', () => ({createClient:jest.fn(async () => mockClient)}))
jest.mock('@/lib/mail', () => ({ queueTransactionalEmail: jest.fn().mockResolvedValue({success:true}) }))
jest.mock('next/cache', () => ({revalidatePath:jest.fn()}))
function query(data: unknown) {
 const result = {
  select:jest.fn(), eq:jest.fn(), in:jest.fn(), order:jest.fn(), insert:jest.fn(), single:jest.fn(),
 }
 result.select.mockReturnValue(result); result.eq.mockReturnValue(result); result.insert.mockReturnValue(result)
 result.in.mockResolvedValue({data,error:null})
 result.order.mockResolvedValue({data,error:null}); result.single.mockResolvedValue({data,error:null})
 return result
}
const previousPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const previousInternalUrl = process.env.SUPABASE_INTERNAL_URL
afterAll(() => {
 if (previousPublicUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousPublicUrl
 if (previousInternalUrl === undefined) delete process.env.SUPABASE_INTERNAL_URL; else process.env.SUPABASE_INTERNAL_URL = previousInternalUrl
})
beforeEach(() => {
 process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://217.154.228.254/supabase'
 process.env.SUPABASE_INTERNAL_URL = 'http://127.0.0.1:9080'
 jest.clearAllMocks()
 mockGetUser.mockResolvedValue({data:{user:{id:owner}}})
 mockRpc.mockResolvedValue({data:promptId,error:null})
 mockSignedUrl.mockResolvedValue({data:{signedUrl:`http://127.0.0.1:9080/storage/v1/object/sign/pronunciation_audio/${owner}/recording.webm?token=a%2Bb%3D`},error:null})
})
describe('authenticated pronunciation writes', () => {
 it('does not create a submission without a verified server session', async () => {
  mockGetUser.mockResolvedValue({data:{user:null}})
  expect(await createPronunciationSubmission({promptId,audioPath:path})).toEqual({success:false,reason:'not_authenticated'})
  expect(mockRpc).not.toHaveBeenCalled()
 })
 it('rejects an audio reference owned by another person', async () => {
  expect(await createPronunciationSubmission({promptId,audioPath:path.replace(owner,other)})).toEqual({success:false,reason:'invalid_input'})
  expect(mockRpc).not.toHaveBeenCalled()
  expect(await sendPronunciationMessage({submissionId:promptId,text:'',audioPath:path.replace(owner,other)})).toEqual({success:false,reason:'invalid_input'})
  expect(mockFrom).not.toHaveBeenCalled()
 })
 it('delegates snapshots, exact course access and storage existence to the atomic database function', async () => {
  expect(await createPronunciationSubmission({promptId,audioPath:path})).toEqual({success:true,id:promptId})
  expect(mockRpc).toHaveBeenCalledWith('create_pronunciation_submission',{p_prompt_id:promptId,p_audio_path:path})
 })
 it('does not acknowledge a JSON submission error as a recording ID', async () => {
  mockRpc.mockResolvedValue({data:{error:'not_authorized',message:'The request is not authorized.'},error:null})
  const log=jest.spyOn(console,'error').mockImplementation(()=>{})
  try { expect(await createPronunciationSubmission({promptId,audioPath:path})).toEqual({success:false,reason:'save_failed'}) }
  finally {log.mockRestore()}
 })
 it('never accepts a caller-provided sender or role for messages', async () => {
  const messages = query({id:promptId}); mockFrom.mockReturnValue(messages)
  await sendPronunciationMessage({submissionId:promptId,text:'Danke!',audioPath:null})
  expect(messages.insert).toHaveBeenCalledWith({submission_id:promptId,sender_id:owner,text_content:'Danke!',audio_path:null})
 })
})
describe('durable teacher feedback notifications', () => {
 function staffMessage() {
  mockFrom.mockImplementation((table:string) => table === 'profiles' ? query({role:'teacher',ui_language:'uk',person:{display_name:'Lernende',email:'student@example.invalid'}}) : table === 'submissions' ? query({auth_user_id:other,level:'A1.1'}) : query({id:promptId}))
 }
 it('queues one localized event using the committed message identity', async () => {
  staffMessage()
  expect(await sendPronunciationMessage({submissionId:promptId,text:'Gut gelesen!',audioPath:null})).toEqual({success:true,id:promptId})
  expect(queueTransactionalEmail).toHaveBeenCalledWith({dedupeKey:`pronunciation-message:${promptId}`,kind:'feedback_available',to:'student@example.invalid',locale:'uk',payload:{name:'Lernende',path:'/uk/dashboard/level/A1.1/pronunciation'}})
 })
 it('keeps a committed message successful when queuing notification fails', async () => {
  staffMessage()
  jest.mocked(queueTransactionalEmail).mockRejectedValueOnce(new Error('Outbox unavailable'))
  const log=jest.spyOn(console,'error').mockImplementation(()=>{})
  try { expect(await sendPronunciationMessage({submissionId:promptId,text:'Gut gelesen!',audioPath:null})).toEqual({success:true,id:promptId}) }
  finally {log.mockRestore()}
 })
})
describe('canonical conversation history', () => {
 const row = {
  id:promptId,auth_user_id:owner,level:'A1.1',prompt:null,text_content:'Mein alter Lesetext.',content_url:'https://legacy.example/recording.webm',status:'reviewed',created_at:'2026-08-01T10:00:00Z',profiles:{name:'Test Student',email:'student@example.invalid'},

  pronunciation_messages:[{id:'new-message',sender_role:'student',text_content:'Meine neue Aufnahme.',audio_path:path,created_at:'2026-08-04T10:00:00Z',seen_at:null}],
 }
 it('enforces ownership and signs only private recording references', async () => {
  const profiles = query({role:'student'}), submissions = query([row])
  mockFrom.mockImplementation((table:string) => table === 'profiles' ? profiles : table === 'people' ? query([{auth_user_id:owner,display_name:'Test Student',email:'student@example.invalid'}]) : submissions)
  const result = await getPronunciationConversations('A1.1')
  expect(submissions.eq).toHaveBeenCalledWith('auth_user_id',owner)
  expect(submissions.eq).toHaveBeenCalledWith('level','A1.1')
  expect(result[0].messages.map((item) => item.id)).toEqual([`recording-${promptId}`,'new-message'])
  expect(result[0].messages[0].audioUrl).toBeNull()
  expect(result[0].messages.at(-1)?.audioUrl).toBe(`https://217.154.228.254/supabase/storage/v1/object/sign/pronunciation_audio/${owner}/recording.webm?token=a%2Bb%3D`)
  expect(mockSignedUrl).toHaveBeenCalledWith(`${owner}/2aab2f11-3456-4234-8234-123456789012.webm`,3600)
  expect(result[0].studentEmail).toBeNull()
  expect(result[0].title).toBeNull()
 })
 it('allows a server-verified teacher to load the queue and student contact', async () => {
  const profiles = query({role:'teacher'}), submissions = query([row])
  mockFrom.mockImplementation((table:string) => table === 'profiles' ? profiles : table === 'people' ? query([{auth_user_id:owner,display_name:'Test Student',email:'student@example.invalid'}]) : submissions)
  const result = await getPronunciationConversations()
  expect(submissions.eq).not.toHaveBeenCalledWith('auth_user_id',owner)
  expect(result[0].studentEmail).toBe('student@example.invalid')
  expect(result[0].hasUnseen).toBe(true)
 })
 it('reads the current lesson title through the prompt relation', async () => {
  const submissions=query([{...row,prompt:{unit:{label:'Renamed lesson'}}}])
  mockFrom.mockImplementation((table:string)=>table==='profiles'?query({role:'teacher'}):table==='people'?query([]):submissions)
  expect((await getPronunciationConversations())[0].title).toBe('Renamed lesson')
  expect(submissions.select.mock.calls[0][0]).toContain('prompt:learning_reading_texts(unit:learning_units(label))')
  expect(submissions.select.mock.calls[0][0]).not.toContain('prompt_title')
 })
})
