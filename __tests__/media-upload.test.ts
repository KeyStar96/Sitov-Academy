import { createMediaUpload, publicTusUrl, readUploadTicket, uploadTicketKey } from '@/lib/media-upload'
import { MAX_MEDIA_BYTES, mediaFileSchema, mediaPath } from '@/lib/media'

const getSession = jest.fn(), refreshSession = jest.fn(), findPreviousUploads = jest.fn(), resumeFromPreviousUpload = jest.fn(), stackRequest = jest.fn()
let options: Record<string, any>
jest.mock('tus-js-client', () => ({
  Upload: jest.fn().mockImplementation((_file, config) => { options = config; return { findPreviousUploads, resumeFromPreviousUpload } }),
  DefaultHttpStack: jest.fn().mockImplementation(() => ({ createRequest: stackRequest })),
}))
jest.mock('@/utils/supabase/client', () => ({ createClient: () => ({ auth: { getSession, refreshSession } }) }))
jest.mock('@/lib/supabase-env', () => ({ readSupabasePublicConfig: () => ({ url: 'https://academy.example/supabase', anonKey: 'public-key' }) }))
const userId = '00000000-0000-4000-8000-000000000001'
const folder = { folder_id: '00000000-0000-4000-8000-000000000002', level: 'A1.1' }
const ticket = { assetId: '00000000-0000-4000-8000-000000000003', title: 'A lesson', completed: false }
const endpoint = 'https://academy.example/supabase/storage/v1/upload/resumable'
const file = new File(['example'], 'lesson.mp4', { type: 'video/mp4', lastModified: 42 })
const callbacks = { onProgress: jest.fn(), onSuccess: jest.fn(), onError: jest.fn() }
const session = (token = 'token', id = userId, expires_at = Math.floor(Date.now() / 1000) + 3600) => ({ access_token: token, user: { id }, expires_at })
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear()
  getSession.mockResolvedValue({ data: { session: session() }, error: null })
  refreshSession.mockResolvedValue({ data: { session: session('refreshed') }, error: null })
  findPreviousUploads.mockResolvedValue([])
})

it('pins every TUS request to the configured self-hosted origin and preserves resumable offsets URLs', () => {
  expect(publicTusUrl('http://storage:5000/upload/resumable/id?signature=abc', endpoint)).toBe(`${endpoint}/id?signature=abc`)
  expect(publicTusUrl('/storage/v1/upload/resumable/id', endpoint)).toBe(`${endpoint}/id`)
  for (const url of ['https://attacker.test/steal', 'https://user:password@host/upload/resumable/id', `${endpoint}/id#fragment`]) expect(() => publicTusUrl(url, endpoint)).toThrow('Invalid upload URL')
})
it('resumes its persisted fingerprint with 6 MiB chunks and never enables upsert', async () => {
  const previous = { uploadUrl: 'http://storage:5000/upload/resumable/id' }
  findPreviousUploads.mockResolvedValue([previous])
  await createMediaUpload(file, folder, ticket, userId, callbacks)
  expect(options.chunkSize).toBe(6 * 1024 * 1024); expect(options.parallelUploads).toBe(1)
  expect(options.removeFingerprintOnSuccess).toBe(true); expect(resumeFromPreviousUpload).toHaveBeenCalledWith(previous)
  expect(options.metadata).toEqual({ bucketName: 'course-assets', objectName: `A1.1/${folder.folder_id}/videos/${ticket.assetId}.mp4`, contentType: 'video/mp4', cacheControl: '60' })
  expect(await options.fingerprint()).toContain(`${userId}:${ticket.assetId}`)
  const request = { setHeader: jest.fn() }; await options.onBeforeRequest(request)
  expect(request.setHeader).toHaveBeenCalledWith('authorization', 'Bearer token')
  expect(request.setHeader).toHaveBeenCalledWith('x-upsert', 'false')
  options.httpStack.createRequest('PATCH', previous.uploadUrl)
  expect(stackRequest).toHaveBeenCalledWith('PATCH', `${endpoint}/id`)
})
it('refreshes expiring or rejected sessions and refuses another signed-in account', async () => {
  await createMediaUpload(file, folder, ticket, userId, callbacks)
  getSession.mockResolvedValueOnce({ data: { session: session('old', userId, Math.floor(Date.now() / 1000) + 20) } })
  const request = { setHeader: jest.fn() }; await options.onBeforeRequest(request)
  expect(request.setHeader).toHaveBeenCalledWith('authorization', 'Bearer refreshed')
  expect(options.onShouldRetry({ originalResponse: { getStatus: () => 401 } })).toBe(true)
  await options.onBeforeRequest(request); expect(refreshSession).toHaveBeenCalledTimes(2)
  getSession.mockResolvedValueOnce({ data: { session: session('other', folder.folder_id) } })
  await expect(options.onBeforeRequest(request)).rejects.toThrow('session_changed')
  expect(options.onShouldRetry({ originalResponse: { getStatus: () => 413 } })).toBe(false)
  expect(options.onShouldRetry({ originalResponse: { getStatus: () => 503 } })).toBe(true)
})
it('keeps retry identity scoped to user, folder and file', () => {
  const key = uploadTicketKey(userId, folder.folder_id, file)
  localStorage.setItem(key, JSON.stringify(ticket))
  expect(readUploadTicket(key, 'ignored retry title')).toEqual(ticket)
  expect(uploadTicketKey(folder.folder_id, folder.folder_id, file)).not.toBe(key)
  expect(uploadTicketKey(userId, userId, file)).not.toBe(key)
})
it('validates browser-declared MIME metadata, extension, and the 512 MiB bound', () => {
  expect(mediaFileSchema.safeParse({ name: 'video.mp4', size: 33 * 1024 * 1024, type: 'video/mp4' }).success).toBe(true)
  expect(mediaFileSchema.safeParse({ name: 'slides.pptx', size: 10, type: 'application/zip' }).success).toBe(true)
  expect(mediaFileSchema.safeParse({ name: 'slides.key', size: 10, type: '' }).success).toBe(true)
  for (const invalid of [
    { name: 'video.mp4', size: MAX_MEDIA_BYTES + 1, type: 'video/mp4' },
    { name: 'video.mp4', size: 0, type: 'video/mp4' },
    { name: 'video.mp4', size: 10, type: 'text/html' },
    { name: '../slides.pdf', size: 10, type: 'application/pdf' },
    { name: 'page.html', size: 10, type: 'text/html' },
  ]) expect(mediaFileSchema.safeParse(invalid).success).toBe(false)
  expect(mediaPath('A1.1', folder.folder_id, ticket.assetId, 'pdf')).toBe(`A1.1/${folder.folder_id}/presentations/${ticket.assetId}.pdf`)
})
