/** @jest-environment node */
import { uploadPrivatePronunciationRecording } from '@/lib/audio/upload'
const owner = '6aab2f11-3456-4234-8234-123456789012'
const mockGetUser = jest.fn()
const mockUpload = jest.fn()
const mockBucket = jest.fn(() => ({upload:mockUpload}))
jest.mock('@/utils/supabase/client', () => ({createClient:() => ({auth:{getUser:mockGetUser},storage:{from:mockBucket}}),SupabaseConfigError:class extends Error {}}))
beforeEach(() => {
 jest.clearAllMocks()
 mockGetUser.mockResolvedValue({data:{user:{id:owner}},error:null})
 mockUpload.mockResolvedValue({error:null})
})
describe('private pronunciation recording uploads', () => {
 it('uses a unique owner path, no overwrite and an opaque storage reference', async () => {
  const blob = new Blob(['recording'],{type:'audio/webm;codecs=opus'})
  const first = await uploadPrivatePronunciationRecording(blob)
  const second = await uploadPrivatePronunciationRecording(blob)
  expect(mockBucket).toHaveBeenCalledWith('pronunciation_audio')
  expect(mockUpload).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^${owner}/[0-9a-f-]{36}\\.webm$`)),blob,{contentType:'audio/webm',upsert:false})
  expect(first.success).toBe(true); expect(second.success).toBe(true)
  if (first.success && second.success) {
   expect(first.publicUrl).toMatch(/^storage:\/\/pronunciation_audio\//)
   expect(first.publicUrl).not.toEqual(second.publicUrl)
  }
 })
 it('does not upload empty, oversized or non-audio blobs', async () => {
  for(const blob of [new Blob([],{type:'audio/webm'}),new Blob(['script'],{type:'text/html'}),new Blob([new Uint8Array(25*1024*1024+1)],{type:'audio/webm'})]) expect(await uploadPrivatePronunciationRecording(blob)).toEqual({success:false,reason:'upload_failed'})
  expect(mockGetUser).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled()
 })
 it('requires the current authenticated owner', async () => {
  mockGetUser.mockResolvedValue({data:{user:null},error:null})
  expect(await uploadPrivatePronunciationRecording(new Blob(['test'],{type:'audio/mp4'}))).toEqual({success:false,reason:'not_authenticated'})
  expect(mockUpload).not.toHaveBeenCalled()
 })
})
