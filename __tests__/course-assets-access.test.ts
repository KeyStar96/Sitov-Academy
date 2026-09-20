/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
const getUser = jest.fn(), createSignedUrl = jest.fn(), profile = jest.fn(), profileId = jest.fn()
jest.mock('@/utils/supabase/server', () => ({ createClient: async () => ({ auth: { getUser }, from: () => ({ select: () => ({ eq: profileId }) }), storage: { from: () => ({ createSignedUrl }) } }) }))
import { POST } from '@/app/api/course-assets/route'
const request = () => new Request('http://localhost/api/course-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: 'A1.1/folder/presentations/asset.pdf' }) })
beforeEach(() => {
  jest.clearAllMocks()
  profileId.mockReturnValue({ single: profile })
  profile.mockResolvedValue({ data: { role: 'student' }, error: null })
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://local.example/supabase'
  process.env.SUPABASE_INTERNAL_URL = 'http://127.0.0.1:9080'
  getUser.mockResolvedValue({ data: { user: { id: 'student' } }, error: null })
})
it('returns403 without leaking signed links when Storage denies the level', async () => {
  createSignedUrl.mockResolvedValue({ data: null, error: { message: 'Object not found' } })
  const response = await POST(request())
  expect(response.status).toBe(403)
  expect(await response.json()).toEqual({ error: 'not_authorized', message: 'This course file is not available to you.' })
})
it('only grants short-lived private links after Storage authorization', async () => {
  createSignedUrl.mockResolvedValue({ data: { signedUrl: 'http://127.0.0.1:9080/storage/v1/object/sign/course-assets/x.pdf?token=test' }, error: null })
  const response = await POST(request())
  expect(createSignedUrl).toHaveBeenCalledWith('A1.1/folder/presentations/asset.pdf', 60)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(await response.json()).toEqual({ url: 'https://local.example/supabase/storage/v1/object/sign/course-assets/x.pdf?token=test', expiresIn: 60 })
})
it('requires a verified auth session before accessing Storage', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null })
  expect((await POST(request())).status).toBe(401)
  expect(createSignedUrl).not.toHaveBeenCalled()
})
it('requests an attachment from Storage for reliable cross-origin downloads', async () => {
  createSignedUrl.mockResolvedValue({ data: { signedUrl: 'http://127.0.0.1:9080/storage/v1/object/sign/course-assets/x.pdf?token=test&download=' }, error: null })
  const response = await POST(new Request('http://localhost/api/course-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: 'A1.1/folder/presentations/asset.pdf', download: true }) }))
  expect(response.status).toBe(200)
  expect(createSignedUrl).toHaveBeenCalledWith('A1.1/folder/presentations/asset.pdf', 60, { download: true })
})

const videoRequest = (download = true, path = 'A1.1/folder/videos/lesson.mp4') => new Request('http://localhost/api/course-assets', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, download }),
})
it.each(['A1.1/folder/videos/lesson.mp4', 'A1.1/folder/videos/lesson.webm', 'A1.1/folder/videos/lesson.mp4?name=lesson.pdf'])('denies student attachment requests for %s before signing', async path => {
  const response = await POST(videoRequest(true, path))
  expect(response.status).toBe(403)
  expect(await response.json()).toMatchObject({ error: 'download_not_allowed' })
  expect(profileId).toHaveBeenCalledWith('id', 'student')
  expect(createSignedUrl).not.toHaveBeenCalled()
})
it('continues to authorize student playback through Storage', async () => {
  createSignedUrl.mockResolvedValue({ data: { signedUrl: 'http://127.0.0.1:9080/storage/v1/object/sign/course-assets/video.mp4?token=test' }, error: null })
  expect((await POST(videoRequest(false))).status).toBe(200)
  expect(createSignedUrl).toHaveBeenCalledWith('A1.1/folder/videos/lesson.mp4', 60)
  expect(profile).not.toHaveBeenCalled()
})
it.each(['teacher', 'admin'])('allows %s video downloads after checking the stored role', async role => {
  profile.mockResolvedValue({ data: { role }, error: null })
  createSignedUrl.mockResolvedValue({ data: { signedUrl: 'http://127.0.0.1:9080/storage/v1/object/sign/course-assets/video.mp4?token=test' }, error: null })
  expect((await POST(videoRequest())).status).toBe(200)
  expect(createSignedUrl).toHaveBeenCalledWith('A1.1/folder/videos/lesson.mp4', 60, { download: true })
})
it('does not grant video downloads when the profile cannot be read', async () => {
  profile.mockResolvedValue({ data: null, error: { code: '42501' } })
  expect((await POST(videoRequest())).status).toBe(403)
  expect(createSignedUrl).not.toHaveBeenCalled()
})
