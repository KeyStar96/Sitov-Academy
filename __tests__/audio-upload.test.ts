import { randomUUID } from 'crypto'
import { uploadPrivatePronunciationRecording } from '@/lib/audio/upload'
import { createClient } from '@/utils/supabase/client'
import { createSitovPronunciationUploadTicket, createSitovPronunciationReplyUploadTicket } from '@/app/actions/sitov-pronunciation-pretest'
jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn(), SupabaseConfigError: class extends Error {} }))
jest.mock('@/app/actions/sitov-pronunciation-pretest', () => ({ createSitovPronunciationUploadTicket: jest.fn(), createSitovPronunciationReplyUploadTicket: jest.fn() }))
const owner = '00000000-0000-4000-8000-000000000001', target = '00000000-0000-4000-8000-000000000002'
const object = '00000000-0000-4000-8000-000000000003', version = 'a'.repeat(64)
let upload: jest.Mock, getUser: jest.Mock, download: jest.Mock
const ticket = () => ({ ticketId: object, path: `${owner}/${object}.webm`, textVersion: version, expiresAt: new Date(Date.now() + 60000).toISOString() })
beforeAll(() => { Object.defineProperty(global.crypto, 'randomUUID', { value: randomUUID, configurable: true }) })
beforeEach(() => {
  jest.clearAllMocks(); upload = jest.fn().mockResolvedValue({ error: null }); download = jest.fn(); getUser = jest.fn().mockResolvedValue({ data: { user: { id: owner } }, error: null })
  jest.mocked(createClient).mockReturnValue({ auth: { getUser }, storage: { from: jest.fn().mockReturnValue({ upload, download }) } } as unknown as ReturnType<typeof createClient>)
  jest.mocked(createSitovPronunciationUploadTicket).mockResolvedValue({ ok: true, data: ticket() })
})
it('uploads only a server-owned target path and reuses it for the same immutable blob retry', async () => {
  const blob = new Blob(['capture'], { type: 'audio/webm;codecs=opus' }); const scope = { purpose: 'target' as const, textId: target, textVersion: version }
  expect(await uploadPrivatePronunciationRecording(blob, scope)).toEqual({ success: true, audioPath: `storage://pronunciation_audio/${owner}/${object}.webm` })
  await uploadPrivatePronunciationRecording(blob, scope)
  expect(upload).toHaveBeenCalledTimes(1); expect(createSitovPronunciationUploadTicket).toHaveBeenCalledTimes(1)
  expect(upload).toHaveBeenCalledWith(`${owner}/${object}.webm`, blob, { contentType: 'audio/webm', upsert: false })
})
it('asks for a reply ticket bound to the exact conversation, never a target ticket', async () => {
  const value = ticket(); const reply = { ticketId: value.ticketId, path: value.path, expiresAt: value.expiresAt }
  jest.mocked(createSitovPronunciationReplyUploadTicket).mockResolvedValue({ ok: true, data: { ...reply, submissionId: target, purpose: 'reply' } })
  expect((await uploadPrivatePronunciationRecording(new Blob(['reply'], { type: 'audio/webm' }), { purpose: 'reply', submissionId: target })).success).toBe(true)
  expect(createSitovPronunciationReplyUploadTicket).toHaveBeenCalledWith(expect.objectContaining({ submissionId: target, extension: 'webm' }))
  expect(createSitovPronunciationUploadTicket).not.toHaveBeenCalled()
})
it.each(['owner', 'version', 'expiry', 'extension'])('rejects a mismatched %s ticket before Storage', async mismatch => {
  const data = ticket()
  if (mismatch === 'owner') data.path = `${target}/${object}.webm`
  if (mismatch === 'version') data.textVersion = 'b'.repeat(64)
  if (mismatch === 'expiry') data.expiresAt = '2020-01-01T00:00:00Z'
  if (mismatch === 'extension') data.path = `${owner}/${object}.mp3`
  jest.mocked(createSitovPronunciationUploadTicket).mockResolvedValue({ ok: true, data })
  expect((await uploadPrivatePronunciationRecording(new Blob(['capture'], { type: 'audio/webm' }), { purpose: 'target', textId: target, textVersion: version })).success).toBe(false)
  expect(upload).not.toHaveBeenCalled()
})
it('rejects an account change while requesting the ticket', async () => {
  getUser.mockResolvedValueOnce({ data: { user: { id: owner } }, error: null }).mockResolvedValue({ data: { user: { id: target } }, error: null })
  expect(await uploadPrivatePronunciationRecording(new Blob(['capture'], { type: 'audio/webm' }), { purpose: 'target', textId: target })).toEqual({ success: false, reason: 'not_authenticated' })
  expect(upload).not.toHaveBeenCalled()
})
it('cannot upload without a purpose and rejects empty or unsupported data', async () => {
  expect((await uploadPrivatePronunciationRecording(new Blob(['capture'], { type: 'audio/webm' }))).success).toBe(false)
  expect((await uploadPrivatePronunciationRecording(new Blob([], { type: 'audio/webm' }), { purpose: 'target', textId: target })).success).toBe(false)
  expect(upload).not.toHaveBeenCalled()
})
it.each([true, false])('recovers a lost Storage response only if persisted bytes match (same=%s)', async same => {
  const blob = new Blob(['capture'], { type: 'audio/webm' })
  const bytes = new Uint8Array([1, 2, 3]).buffer
  Object.defineProperty(blob, 'arrayBuffer', { value: async () => bytes })
  upload.mockResolvedValue({ error: { statusCode: 409, message: 'exists' } })
  download.mockResolvedValue({ error: null, data: { size: blob.size, arrayBuffer: async () => same ? bytes : new Uint8Array([3, 2, 1]).buffer } })
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    expect((await uploadPrivatePronunciationRecording(blob, { purpose: 'target', textId: target, textVersion: version })).success).toBe(same)
    expect(download).toHaveBeenCalledWith(`${owner}/${object}.webm`)
  } finally { log.mockRestore() }
})
