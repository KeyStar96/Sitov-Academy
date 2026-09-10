/** @jest-environment node */
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
jest.mock('@/utils/supabase/server', () => ({createClient:jest.fn(async () => mockClient)}))
jest.mock('next/cache', () => ({revalidatePath:jest.fn()}))
function query(data: unknown) {
 const result = {
  select:jest.fn(), eq:jest.fn(), order:jest.fn(), insert:jest.fn(), single:jest.fn(),
 }
 result.select.mockReturnValue(result); result.eq.mockReturnValue(result); result.insert.mockReturnValue(result)
 result.order.mockResolvedValue({data,error:null}); result.single.mockResolvedValue({data,error:null})
 return result
}
beforeEach(() => {
 jest.clearAllMocks()
 mockGetUser.mockResolvedValue({data:{user:{id:owner}}})
 mockRpc.mockResolvedValue({data:promptId,error:null})
 mockSignedUrl.mockResolvedValue({data:{signedUrl:'https://signed.example/recording'},error:null})
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
 it('never accepts a caller-provided sender or role for messages', async () => {
  const messages = query({id:promptId}); mockFrom.mockReturnValue(messages)
  await sendPronunciationMessage({submissionId:promptId,text:'Danke!',audioPath:null})
  expect(messages.insert).toHaveBeenCalledWith({submission_id:promptId,sender_id:owner,text_content:'Danke!',audio_path:null})
 })
})
describe('legacy and new conversation history', () => {
 const row = {
  id:promptId,user_id:owner,level:'A1.1',prompt_title:null,text_content:'Mein alter Lesetext.',content_url:'https://legacy.example/recording.webm',status:'reviewed',created_at:'2026-08-01T10:00:00Z',profiles:{name:'Test Student',email:'student@example.invalid'},
  teacher_feedback:[{id:'old-feedback-1',feedback_text:'Bitte langsamer.',feedback_audio_url:null,created_at:'2026-08-02T10:00:00Z',seen_at:null},{id:'old-feedback-2',feedback_text:'Schon besser!',feedback_audio_url:'https://legacy.example/feedback.webm',created_at:'2026-08-03T10:00:00Z',seen_at:null}],
  pronunciation_messages:[{id:'new-message',sender_role:'student',text_content:'Meine neue Aufnahme.',audio_path:path,created_at:'2026-08-04T10:00:00Z',seen_at:null}],
 }
 it('enforces the student owner filter, retains every legacy feedback and signs only private references', async () => {
  const profiles = query({role:'student'}), submissions = query([row])
  mockFrom.mockImplementation((table:string) => table === 'profiles' ? profiles : submissions)
  const result = await getPronunciationConversations('A1.1')
  expect(submissions.eq).toHaveBeenCalledWith('user_id',owner)
  expect(submissions.eq).toHaveBeenCalledWith('level','A1.1')
  expect(result[0].messages.map((item) => item.id)).toEqual([`recording-${promptId}`,'old-feedback-1','old-feedback-2','new-message'])
  expect(result[0].messages[0].audioUrl).toBe(row.content_url)
  expect(result[0].messages.at(-1)?.audioUrl).toBe('https://signed.example/recording')
  expect(mockSignedUrl).toHaveBeenCalledWith(`${owner}/2aab2f11-3456-4234-8234-123456789012.webm`,3600)
  expect(result[0].studentEmail).toBeNull()
 })
 it('allows a server-verified teacher to load the queue and student contact', async () => {
  const profiles = query({role:'teacher'}), submissions = query([row])
  mockFrom.mockImplementation((table:string) => table === 'profiles' ? profiles : submissions)
  const result = await getPronunciationConversations()
  expect(submissions.eq).not.toHaveBeenCalledWith('user_id',owner)
  expect(result[0].studentEmail).toBe('student@example.invalid')
  expect(result[0].hasUnseen).toBe(true)
 })
})
