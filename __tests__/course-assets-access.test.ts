/** @jest-environment node */
const getUser = jest.fn(), createSignedUrl = jest.fn()
jest.mock('@/utils/supabase/server', () => ({ createClient: async () => ({ auth: { getUser }, storage: { from: () => ({ createSignedUrl }) } }) }))
import { POST } from '@/app/api/course-assets/route'
const request = () => new Request('http://localhost/api/course-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: 'A1.1/folder/presentations/asset.pdf' }) })
beforeEach(() => { jest.clearAllMocks(); getUser.mockResolvedValue({ data: { user: { id: 'student' } }, error: null }) })
it('returns403 without leaking signed links when Storage denies the level', async () => {
  createSignedUrl.mockResolvedValue({ data: null, error: { message: 'Object not found' } })
  const response = await POST(request())
  expect(response.status).toBe(403)
  expect(await response.json()).toEqual({ error: 'not_authorized', message: 'This course file is not available to you.' })
})
it('only grants short-lived private links after Storage authorization', async () => {
  createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://local.example/signed' }, error: null })
  const response = await POST(request())
  expect(createSignedUrl).toHaveBeenCalledWith('A1.1/folder/presentations/asset.pdf', 60)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect((await response.json()).expiresIn).toBe(60)
})
it('requires a verified auth session before accessing Storage', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null })
  expect((await POST(request())).status).toBe(401)
  expect(createSignedUrl).not.toHaveBeenCalled()
})
