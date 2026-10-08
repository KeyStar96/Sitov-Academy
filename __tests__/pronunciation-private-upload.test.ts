/** @jest-environment node */
import { uploadPrivatePronunciationRecording } from '@/lib/audio/upload'
const owner = '6aab2f11-3456-4234-8234-123456789012'
const target = '6aab2f11-3456-4234-8234-123456789013'
const object = '6aab2f11-3456-4234-8234-123456789014'
const scope = { purpose: 'target' as const, textId: target, textVersion: 'a'.repeat(64) }
const mockTicket = jest.fn()
jest.mock('@/app/actions/sitov-pronunciation-pretest', () => ({ createSitovPronunciationUploadTicket: (...args: unknown[]) => mockTicket(...args), createSitovPronunciationReplyUploadTicket: jest.fn() }))
const mockGetUser = jest.fn()
const mockUpload = jest.fn()
const mockBucket = jest.fn(() => ({upload:mockUpload}))
jest.mock('@/utils/supabase/client', () => ({createClient:() => ({auth:{getUser:mockGetUser},storage:{from:mockBucket}}),SupabaseConfigError:class extends Error {}}))
beforeEach(() => {
 jest.clearAllMocks()
 mockGetUser.mockResolvedValue({data:{user:{id:owner}},error:null})
 mockUpload.mockResolvedValue({error:null})
 mockTicket.mockResolvedValue({ok:true,data:{ticketId:object,path:`${owner}/${object}.webm`,textVersion:scope.textVersion,expiresAt:new Date(Date.now()+60000).toISOString()}})
})
describe('private pronunciation recording uploads', () => {
 it('uses a server-issued owner path, no overwrite and one immutable recording for retries', async () => {
  const blob = new Blob(['recording'],{type:'audio/webm;codecs=opus'})
  const first = await uploadPrivatePronunciationRecording(blob, scope)
  const second = await uploadPrivatePronunciationRecording(blob, scope)
  expect(mockBucket).toHaveBeenCalledWith('pronunciation_audio')
  expect(mockUpload).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^${owner}/[0-9a-f-]{36}\\.webm$`)),blob,{contentType:'audio/webm',upsert:false})
  expect(first.success).toBe(true); expect(second.success).toBe(true)
  if (first.success && second.success) {
   expect(first.audioPath).toMatch(/^storage:\/\/pronunciation_audio\//)
   expect(first.audioPath).toEqual(second.audioPath)
   expect(mockUpload).toHaveBeenCalledTimes(1)
   expect(mockTicket).toHaveBeenCalledTimes(1)
  }
 })
 it('does not upload empty, oversized or non-audio blobs', async () => {
  for(const blob of [new Blob([],{type:'audio/webm'}),new Blob(['script'],{type:'text/html'}),new Blob([new Uint8Array(25*1024*1024+1)],{type:'audio/webm'})]) expect(await uploadPrivatePronunciationRecording(blob, scope)).toEqual({success:false,reason:'upload_failed'})
  expect(mockGetUser).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled()
 })
 it('requires the current authenticated owner', async () => {
  mockGetUser.mockResolvedValue({data:{user:null},error:null})
  expect(await uploadPrivatePronunciationRecording(new Blob(['test'],{type:'audio/mp4'}), scope)).toEqual({success:false,reason:'not_authenticated'})
  expect(mockUpload).not.toHaveBeenCalled()
 })
})
