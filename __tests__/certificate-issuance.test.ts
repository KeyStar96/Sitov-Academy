/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/profile-person', () => ({ resolveVerifiedPerson: jest.fn() }))
jest.mock('@/lib/certificates/pdf', () => ({ renderCertificatePdf: jest.fn() }))

import { createHash } from 'node:crypto'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { resolveVerifiedPerson } from '@/lib/profile-person'
import { renderCertificatePdf } from '@/lib/certificates/pdf'
import { certificateActor, issueCertificate, readCertificateRequest } from '@/lib/certificates/issuance'
import { POST } from '@/app/api/certificates/route'
import { GET } from '@/app/api/certificates/[id]/route'
import type { CertificateEligibilityPeriod } from '@/lib/certificates/types'
import type { Json } from '@/supabase/database.types'

const actorId = '00000000-0000-4000-8000-000000000001'
const personId = '00000000-0000-4000-8000-000000000002'
const issueId = '00000000-0000-4000-8000-000000000003'
const periodId = '00000000-0000-4000-8000-000000000004'
const courseId = '00000000-0000-4000-8000-000000000005'
const allocationId = '00000000-0000-4000-8000-000000000006'
const invoiceId = '00000000-0000-4000-8000-000000000007'
const otherPersonId = '00000000-0000-4000-8000-000000000008'
const origin = 'https://school.example.test'
const storagePath = `${personId}/${issueId}.pdf`
const pdf = Buffer.from('%PDF-1.4\nMock certificate bytes\n%%EOF')
const digest = createHash('sha256').update(pdf).digest('hex')
const actor = { userId: actorId, personId }
const period: CertificateEligibilityPeriod = {
  id: periodId, person_id: personId, course_id: courseId,
  start_date: '2026-09-03', end_date: '2026-09-25', status: 'confirmed',
  title_snapshot: 'Deutsch B1', description_snapshot: 'Bestätigter Kursinhalt', schedule_snapshot: [],
  revision: 2, source_revision: 2, eligible: true, reason: null,
  allocations: [{ id: allocationId, invoice_id: invoiceId, start_date: '2026-09-01', end_date: '2026-09-30',
    source_revision: 3, invoice_revision: 4, payment_status: 'paid', validity: 'valid', invoice_number: 'R-TEST' }],
}
function issue(status: 'generating' | 'issued' | 'failed' | 'revoked' = 'generating') {
  return { id: issueId, person_id: personId, certificate_number: 'SA-2026-TEST', status,
    storage_bucket: 'certificates', storage_path: storagePath, pdf_sha256: status === 'issued' || status === 'revoked' ? digest : null,
    snapshot: { person: { display_name: 'Тест Шюлер', street: 'Hauptstraße 1', postal_code: '30165', city: 'Hannover' },
      periods: [period], date: '2026-09-29' },
  }
}
type RpcArgs = { p_actor: string; p_command: string; p_payload: Json }
function setup() {
  const getUser = jest.fn().mockResolvedValue({ data: { user: { id: actorId, email: 'verified@example.test', email_confirmed_at: '2026-01-01T00:00:00Z', is_anonymous: false } }, error: null })
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser } } as unknown as Awaited<ReturnType<typeof createClient>>)
  jest.mocked(resolveVerifiedPerson).mockResolvedValue({ id: personId, unresolved: false })
  const rpc = jest.fn(async (_name: string, args: RpcArgs) => ({ error: null, data: issue(args.p_command === 'fail' ? 'failed' : args.p_command === 'reserve' ? 'generating' : 'issued') as Json }))
  const storage = {
    upload: jest.fn().mockResolvedValue({ data: { path: storagePath }, error: null }),
    remove: jest.fn().mockResolvedValue({ data: [], error: null }),
    download: jest.fn().mockResolvedValue({ data: new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), error: null }),
  }
  const service = { rpc, storage: { from: jest.fn().mockReturnValue(storage) } }
  jest.mocked(createAdminClient).mockReturnValue(service as unknown as ReturnType<typeof createAdminClient>)
  jest.mocked(renderCertificatePdf).mockResolvedValue(pdf)
  return { service, storage, getUser }
}
function post(body: string = JSON.stringify({ month: '2026-09-01' }), headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/certificates`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body })
}
function get(id = issueId) { return GET(new Request(`${origin}/api/certificates/${id}`), { params: Promise.resolve({ id }) }) }
function expectPrivate(response: Response) {
  expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0')
  expect(response.headers.get('Vary')).toBe('Cookie')
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
}
const savedEnvironment = { SITE_URL: process.env.SITE_URL, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL }
beforeEach(() => { jest.resetAllMocks(); delete process.env.SITE_URL; delete process.env.NEXT_PUBLIC_SITE_URL })
afterAll(() => { for (const [key, value] of Object.entries(savedEnvironment)) { if (value === undefined) delete process.env[key]; else process.env[key] = value } })

it.each([
  ['signed out', null],
  ['unverified', { id: actorId }],
  ['anonymous', { id: actorId, email_confirmed_at: '2026-01-01', is_anonymous: true }],
])('POST rejects %s before a privileged client or renderer is used', async (_name, user) => {
  const { getUser } = setup()
  getUser.mockResolvedValue({ data: { user }, error: null })
  const response = await POST(post())
  expect(response.status).toBe(401); expectPrivate(response)
  expect(await response.json()).toEqual({ error: 'not_authenticated' })
  expect(createAdminClient).not.toHaveBeenCalled(); expect(renderCertificatePdf).not.toHaveBeenCalled()
})

it('derives the actor exclusively from verified Auth and the durable person association', async () => {
  setup()
  await expect(certificateActor()).resolves.toEqual(actor)
  expect(resolveVerifiedPerson).toHaveBeenCalledWith(expect.objectContaining({ id: actorId }))
})

it.each([{ id: null, unresolved: false }, { id: personId, unresolved: true }])('rejects unresolved or missing business identity: %j', async identity => {
  setup(); jest.mocked(resolveVerifiedPerson).mockResolvedValue(identity)
  const response = await POST(post())
  expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: 'identity_unresolved' })
  expect(createAdminClient).not.toHaveBeenCalled()
})

it.each([
  [{ Origin: 'https://attacker.example.test' }, 403],
  [{ Origin: 'null' }, 403],
  [{ 'Sec-Fetch-Site': 'cross-site' }, 403],
  [{ 'Content-Type': 'text/plain' }, 400],
] as const)('rejects unsafe POST request headers %j before authentication', async (headers, expectedStatus) => {
  setup()
  const response = await POST(post(undefined, headers))
  expect(response.status).toBe(expectedStatus); expectPrivate(response)
  expect(createClient).not.toHaveBeenCalled(); expect(createAdminClient).not.toHaveBeenCalled()
})

it('rejects a POST without Origin and accepts a configured external origin behind the proxy', async () => {
  setup()
  const missing = new Request(`${origin}/api/certificates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"month":null}' })
  expect((await POST(missing)).status).toBe(403)
  process.env.SITE_URL = origin
  const proxied = new Request('http://127.0.0.1:3000/api/certificates', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json; charset=utf-8' }, body: '{"month":null}' })
  expect((await POST(proxied)).status).toBe(201)
})

it.each([
  '{',
  JSON.stringify({ month: '2026-09-15' }),
  JSON.stringify({ month: '2026-02-30' }),
  JSON.stringify({ month: null, person_id: otherPersonId }),
  JSON.stringify({ month: null, name: 'Forged name', periods: [period] }),
  JSON.stringify({}),
])('rejects malformed, non-month, or forged request bodies: %s', async body => {
  setup()
  const response = await POST(post(body))
  expect(response.status).toBe(400); expectPrivate(response)
  expect(createAdminClient).not.toHaveBeenCalled()
})

it('stops reading and cancels an oversized streamed body even without a Content-Length header', async () => {
  const cancel = jest.fn()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array(700)); controller.enqueue(new Uint8Array(500)) }, cancel,
  })
  const request = new Request(`${origin}/api/certificates`, { method: 'POST', body: stream, duplex: 'half' } as RequestInit & { duplex: string })
  await expect(readCertificateRequest(request)).rejects.toMatchObject({ status: 413, code: 'invalid_input' })
  expect(cancel).toHaveBeenCalledTimes(1)
  expect(stream.locked).toBe(false)
})

it('renders the reserved immutable snapshot and finalizes the exact private PDF hash', async () => {
  const { service, storage } = setup()
  const response = await POST(post())
  expect(response.status).toBe(201); expectPrivate(response)
  expect(await response.json()).toEqual({ id: issueId })
  expect(service.rpc).toHaveBeenNthCalledWith(1, 'certificate_issue_command', { p_actor: actorId, p_command: 'reserve', p_payload: { month: '2026-09-01' } })
  expect(renderCertificatePdf).toHaveBeenCalledWith({ certificate_number: 'SA-2026-TEST', snapshot: issue().snapshot })
  expect(service.storage.from).toHaveBeenCalledWith('certificates')
  expect(storage.upload).toHaveBeenCalledWith(storagePath, pdf, { contentType: 'application/pdf', cacheControl: '0', upsert: false, metadata: { issue_id: issueId, sha256: digest } })
  expect(service.rpc).toHaveBeenNthCalledWith(2, 'certificate_issue_command', { p_actor: actorId, p_command: 'finalize', p_payload: { id: issueId, pdf_sha256: digest } })
  expect(storage.remove).not.toHaveBeenCalled()
})

it('reuses an issued reservation without rendering or overwriting its stored PDF', async () => {
  const { service, storage } = setup()
  service.rpc.mockResolvedValue({ error: null, data: issue('issued') })
  await expect(issueCertificate(actor, null)).resolves.toBe(issueId)
  expect(service.rpc).toHaveBeenCalledTimes(1)
  expect(renderCertificatePdf).not.toHaveBeenCalled(); expect(storage.upload).not.toHaveBeenCalled()
})

it.each(['person', 'path', 'snapshot owner'] as const)('rejects a reservation with a mismatched %s', async mismatch => {
  const { service, storage } = setup()
  const record = issue()
  if (mismatch === 'person') record.person_id = otherPersonId
  if (mismatch === 'path') record.storage_path = `${otherPersonId}/${issueId}.pdf`
  if (mismatch === 'snapshot owner') record.snapshot.periods = [{ ...period, person_id: otherPersonId }]
  service.rpc.mockResolvedValue({ error: null, data: record })
  const response = await POST(post())
  expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: 'not_available' })
  expect(renderCertificatePdf).not.toHaveBeenCalled(); expect(storage.upload).not.toHaveBeenCalled()
})

it.each([
  ['invalid_input', 400, 'invalid_input'],
  ['conflict', 409, 'source_changed'],
  ['unexpected', 503, 'request_failed'],
] as const)('maps structured reserve error %s safely', async (error, status, responseError) => {
  const { service } = setup()
  service.rpc.mockResolvedValue({ data: { error, message: 'Private invoice or student information' }, error: null })
  const response = await POST(post())
  expect(response.status).toBe(status); expectPrivate(response)
  expect(await response.json()).toEqual({ error: responseError })
  expect(renderCertificatePdf).not.toHaveBeenCalled()
})

it('cleans a possibly committed upload once the database confirms the issue failed', async () => {
  const { service, storage } = setup()
  storage.upload.mockResolvedValue({ data: null, error: { message: 'Upload committed but the response timed out' } })
  const response = await POST(post())
  expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: 'storage_failed' })
  expect(service.rpc).toHaveBeenLastCalledWith('certificate_issue_command', { p_actor: actorId, p_command: 'fail', p_payload: { id: issueId } })
  expect(storage.remove).toHaveBeenCalledWith([storagePath])
})

it.each(['issued', 'revoked'] as const)('preserves the PDF when failed finalization transport is followed by DB status %s', async status => {
  const { service, storage } = setup()
  service.rpc.mockImplementation(async (_name, args) => {
    if (args.p_command === 'finalize') return { error: null, data: { error: 'unexpected' } }
    return { error: null, data: issue(args.p_command === 'fail' ? status : 'generating') }
  })
  const response = await POST(post())
  expect(response.status).toBe(503)
  expect(storage.upload).toHaveBeenCalledTimes(1)
  expect(storage.remove).not.toHaveBeenCalled()
})

it('preserves a private object when the database cannot confirm its final state', async () => {
  const { service, storage } = setup()
  service.rpc.mockImplementation(async (_name, args) => {
    if (args.p_command === 'reserve') return { data: issue(), error: null }
    return { data: { error: 'unexpected' }, error: null }
  })
  const response = await POST(post())
  expect(response.status).toBe(503)
  expect(storage.remove).not.toHaveBeenCalled()
})

it('fails and cleans the private object when reconciliation invalidates sources before finalize', async () => {
  const { service, storage } = setup()
  service.rpc.mockImplementation(async (_name, args) => args.p_command === 'finalize'
    ? { data: { error: 'conflict' }, error: null }
    : { data: issue(args.p_command === 'fail' ? 'failed' : 'generating'), error: null })
  const response = await POST(post())
  expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: 'source_changed' })
  expect(storage.remove).toHaveBeenCalledWith([storagePath])
})

it.each([Buffer.alloc(0), Buffer.from('<html>not a PDF</html>')])('does not upload invalid renderer output', async output => {
  const { storage } = setup(); jest.mocked(renderCertificatePdf).mockResolvedValue(output)
  const response = await POST(post())
  expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: 'render_failed' })
  expect(storage.upload).not.toHaveBeenCalled()
})

it('serves an owned PDF only after two eligibility checks and a hash match', async () => {
  const { service, storage } = setup()
  const response = await get()
  expect(response.status).toBe(200); expectPrivate(response)
  expect(response.headers.get('Content-Type')).toBe('application/pdf')
  expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="Teilnahmebescheinigung-SA-2026-TEST.pdf"')
  expect(response.headers.get('Content-Length')).toBe(String(pdf.length))
  expect(Buffer.from(await response.arrayBuffer())).toEqual(pdf)
  expect(storage.download).toHaveBeenCalledWith(storagePath)
  expect(service.rpc.mock.calls.map(([, args]) => args)).toEqual([
    { p_actor: actorId, p_command: 'download', p_payload: { id: issueId } },
    { p_actor: actorId, p_command: 'download', p_payload: { id: issueId } },
  ])
})

it('returns no PDF bytes if sources become invalid during the Storage fetch', async () => {
  const { service, storage } = setup()
  service.rpc.mockResolvedValueOnce({ data: issue('issued'), error: null }).mockResolvedValueOnce({ data: { error: 'conflict' }, error: null })
  const response = await get()
  expect(storage.download).toHaveBeenCalledTimes(1)
  expect(response.status).toBe(409); expectPrivate(response)
  expect(response.headers.get('Content-Type')).toContain('application/json')
  expect(await response.json()).toEqual({ error: 'source_changed' })
})

it('rejects a downloaded blob with an unexpected digest', async () => {
  const { storage } = setup()
  storage.download.mockResolvedValue({ data: new Blob(['tampered private bytes']), error: null })
  const response = await get()
  expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: 'storage_failed' })
})

it('rejects oversized stored files before reading their bytes', async () => {
  const { storage } = setup()
  const arrayBuffer = jest.fn()
  storage.download.mockResolvedValue({ data: { size: 10 * 1024 * 1024 + 1, arrayBuffer }, error: null })
  const response = await get()
  expect(response.status).toBe(503); expect(arrayBuffer).not.toHaveBeenCalled()
})

it('does not access Storage when the database rejects a foreign certificate', async () => {
  const { service, storage } = setup()
  service.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Foreign student name' } } as unknown as Awaited<ReturnType<typeof service.rpc>>)
  const response = await get()
  expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: 'not_available' })
  expect(storage.download).not.toHaveBeenCalled()
})

it('rejects malformed certificate IDs before privileged lookup', async () => {
  setup()
  const response = await get('../another-user/file.pdf')
  expect(response.status).toBe(400); expectPrivate(response)
  expect(createAdminClient).not.toHaveBeenCalled()
})
