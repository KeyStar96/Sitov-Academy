/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn() }))
jest.mock('@/lib/audio/sitov-audio-access-server', () => ({ resolveSitovAuthoredAudio: jest.fn() }))
jest.mock('@/lib/audio/neural-cache', () => ({ findCachedAudio: jest.fn(), neuralAudioPath: () => 'prepared/de/example.mp3' }))

import { GET, HEAD } from '@/app/api/sitov-audio/route'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { rateLimit } from '@/lib/ratelimit'
import { resolveSitovAuthoredAudio } from '@/lib/audio/sitov-audio-access-server'
import { findCachedAudio } from '@/lib/audio/neural-cache'
import { sitovAudioGatewayUrl } from '@/lib/audio/sitov-audio-reference'

const id = '00000000-0000-4000-8000-000000000001'
const reference = { kind: 'reading_text' as const, id, part: 'reference' as const }
const sha = 'a'.repeat(64)
const url = `https://example.test${sitovAudioGatewayUrl(reference, 'de', sha)}`
let download: jest.Mock
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id } }, error: null }) } } as unknown as Awaited<ReturnType<typeof createClient>>)
  jest.mocked(resolveSitovAuthoredAudio).mockResolvedValue({ reference, language: 'de', text: 'Paul lernt.', textSha256: sha, recording: null })
  jest.mocked(findCachedAudio).mockResolvedValue({ audioUrl: 'storage://audio_cache/prepared/de/example.mp3' })
  jest.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 1, limit: 180, reset: 0 })
  download = jest.fn().mockResolvedValue({ data: new Blob(['0123456789'], { type: 'audio/mpeg' }), error: null })
  jest.mocked(createAdminClient).mockReturnValue({ storage: { from: () => ({ download }) } } as unknown as ReturnType<typeof createAdminClient>)
})

test('streams prepared bytes privately without redirects, credentials or storage URLs', async () => {
  const response = await GET(new Request(url))
  expect(response.status).toBe(200)
  expect(await response.text()).toBe('0123456789')
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(response.headers.get('vary')).toBe('Cookie')
  expect(response.headers.get('location')).toBeNull()
})
test('supports bounded Range and HEAD after current authorization', async () => {
  const response = await GET(new Request(url, { headers: { Range: 'bytes=2-4' } }))
  expect(response.status).toBe(206)
  expect(response.headers.get('content-range')).toBe('bytes 2-4/10')
  expect(await response.text()).toBe('234')
  const head = await HEAD(new Request(url))
  expect(head.headers.get('content-length')).toBe('10')
  expect(await head.text()).toBe('')
  expect(resolveSitovAuthoredAudio).toHaveBeenCalledTimes(2)
})
test('an earlier authorized URL cannot fetch further bytes after rights or exact pass revocation', async () => {
  expect((await GET(new Request(url))).status).toBe(200)
  jest.mocked(resolveSitovAuthoredAudio).mockResolvedValue(null)
  expect((await GET(new Request(url, { headers: { Range: 'bytes=2-' } }))).status).toBe(404)
  expect(download).toHaveBeenCalledTimes(1)
})
test('rejects account absence, changed canonical text, malformed identity and missing preparation before download', async () => {
  jest.mocked(createClient).mockResolvedValueOnce({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as unknown as Awaited<ReturnType<typeof createClient>>)
  expect((await GET(new Request(url))).status).toBe(401)
  expect((await GET(new Request(url.replace(sha, 'b'.repeat(64))))).status).toBe(404)
  expect((await GET(new Request(`${url}&path=secret.mp3`))).status).toBe(400)
  jest.mocked(findCachedAudio).mockResolvedValue(null)
  expect((await GET(new Request(url))).status).toBe(404)
  expect(download).not.toHaveBeenCalled()
})
test('rejects invalid multi-range requests and unavailable objects without exposing private diagnostics', async () => {
  const invalid = await GET(new Request(url, { headers: { Range: 'bytes=0-1,4-5' } }))
  expect(invalid.status).toBe(416)
  expect(invalid.headers.get('content-range')).toBe('bytes */10')
  download.mockResolvedValue({ data: null, error: { message: 'secret private object path' } })
  const missing = await GET(new Request(url))
  expect(missing.status).toBe(404)
  expect(await missing.text()).toBe('')
})
