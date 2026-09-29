/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/profile-person', () => ({ resolveVerifiedPerson: jest.fn() }))

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { resolveVerifiedPerson } from '@/lib/profile-person'
import { executeCertificateCommand, getCertificateAdminData, getStudentCertificateData, previewCertificateImport, getStaffCertificateEligibility } from '@/app/actions/certificates'

const actorId = '00000000-0000-4000-8000-000000000001'
const personId = '00000000-0000-4000-8000-000000000002'
const invoiceId = '00000000-0000-4000-8000-000000000003'
const courseId = '00000000-0000-4000-8000-000000000004'
const batchId = '00000000-0000-4000-8000-000000000005'

function setup(role = 'teacher', verified = true, signedIn = true) {
  const user = { id: actorId, email_confirmed_at: verified ? '2026-01-01T00:00:00Z' : undefined }
  const profile = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { role }, error: null }) }
  const empty = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), range: jest.fn().mockResolvedValue({ data: [], error: null }) }
  const client = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: signedIn ? user : null }, error: null }) }, from: jest.fn((table: string) => table === 'profiles' ? profile : empty) }
  const rpc = jest.fn().mockResolvedValue({ data: { id: invoiceId }, error: null })
  const service = { rpc, from: jest.fn() }
  jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  jest.mocked(createAdminClient).mockReturnValue(service as unknown as ReturnType<typeof createAdminClient>)
  return { client, service, empty }
}

beforeEach(() => jest.clearAllMocks())

it.each([
  ['student', true, true, 'not_authorized'],
  ['teacher', false, true, 'not_authenticated'],
  ['teacher', true, false, 'not_authenticated'],
] as const)('rejects %s verified=%s signedIn=%s before privileged work', async (role, verified, signedIn, error) => {
  setup(role, verified, signedIn)
  expect(await getCertificateAdminData()).toEqual({ success: false, error })
  expect(await executeCertificateCommand({ command: 'apply_import', payload: { batch_id: batchId } })).toEqual({ success: false, error })
  expect(await previewCertificateImport(new FormData())).toEqual({ success: false, error })
  expect(createAdminClient).not.toHaveBeenCalled()
})

it.each([
  { command: 'stage_import', payload: { rows: [{ normalized_data: { payment_status: 'paid' } }] } },
  { command: 'apply_import', payload: { batch_id: batchId, actor_id: personId } },
  { command: 'allocate', payload: { invoice_id: invoiceId, course_id: courseId, person_id: personId, start: '2026-09-01', end: '2026-09-20' } },
  { command: 'allocate', payload: { invoice_id: invoiceId, course_id: courseId, start: '2026-09-01', end: '2026-10-20' } },
  { command: 'allocate', payload: { invoice_id: invoiceId, course_id: courseId, start: '2026-02-30', end: '2026-02-30' } },
])('rejects forged or invalid certificate mutations before creating service client', async input => {
  setup()
  expect(await executeCertificateCommand(input)).toEqual({ success: false, error: 'invalid_input' })
  expect(createAdminClient).not.toHaveBeenCalled()
})

it('takes the staff actor only from the verified server session', async () => {
  const { service } = setup()
  const command = { command: 'apply_import', payload: { batch_id: batchId } }
  expect(await executeCertificateCommand(command)).toEqual({ success: true, data: { id: invoiceId } })
  expect(service.rpc).toHaveBeenCalledWith('certificate_staff_command', { p_actor: actorId, p_command: 'apply_import', p_payload: command.payload })
})

it.each([['40001', 'conflict'], ['22023', 'invalid_input'], ['42501', 'not_authorized']] as const)('maps SQL %s without exposing internal text', async (code, error) => {
  const { service } = setup()
  service.rpc.mockResolvedValue({ data: null, error: { code, message: 'private contact data' } })
  expect(await executeCertificateCommand({ command: 'apply_import', payload: { batch_id: batchId } })).toEqual({ success: false, error })
})

it('does not use service-role data while the verified account/person association is unresolved', async () => {
  setup('student')
  jest.mocked(resolveVerifiedPerson).mockResolvedValue({ id: personId, unresolved: true })
  expect(await getStudentCertificateData()).toEqual({ success: true, data: {
    person: null, identityUnresolved: true, periods: [], issues: [], paymentUpdatedAt: null,
  } })
  expect(resolveVerifiedPerson).toHaveBeenCalledWith(expect.objectContaining({ id: actorId }))
  expect(createAdminClient).not.toHaveBeenCalled()
})

it('paginates staff datasets beyond one API page', async () => {
  const { client, empty } = setup()
  const people = { ...empty, range: jest.fn((from: number) => Promise.resolve({ error: null,
    data: Array.from({ length: from === 0 ? 500 : 1 }, (_, index) => ({
      id: `person-${from + index}`, display_name: 'Student', email: 'student@example.test', street: null, postal_code: null, city: null,
    })),
  })) }
  people.select = jest.fn().mockReturnValue(people)
  people.order = jest.fn().mockReturnValue(people)
  const original = client.from.getMockImplementation()
  client.from.mockImplementation((table: string) => table === 'people' ? people : original!(table))
  const result = await getCertificateAdminData()
  expect(result.success).toBe(true)
  if (result.success) expect(result.data.people).toHaveLength(501)
  expect(people.range).toHaveBeenNthCalledWith(1, 0, 499)
  expect(people.range).toHaveBeenNthCalledWith(2, 500, 999)
})

it('stages only server-parsed CSV content, ignoring forged normalized rows in multipart fields', async () => {
  const { service } = setup()
  service.rpc.mockImplementation((name: string) => Promise.resolve({ error: null, data: name === 'certificate_import_baseline' ? 'a'.repeat(32) : { batch_id: batchId, status: 'preview', summary: {} } }))
  const data = new FormData()
  data.set('kind', 'customers')
  data.set('exportedAt', new Date().toISOString())
  data.set('file', new File(['Name;Kontaktart;Kunden-/Lieferantennr.;E-Mail\nStudent;Kunde;K-1;student@example.test\n'], '../contacts.csv', { type: 'text/csv' }))
  data.set('rows', JSON.stringify([{ normalized_data: { email: 'attacker@example.test' } }]))
  const result = await previewCertificateImport(data)
  expect(result.success).toBe(true)
  expect(service.rpc).toHaveBeenCalledWith('certificate_staff_command', expect.objectContaining({
    p_actor: actorId, p_command: 'stage_import', p_payload: expect.objectContaining({ filename: 'contacts.csv', expected_baseline: 'a'.repeat(32),
      rows: [expect.objectContaining({ external_key: 'K-1', normalized_data: expect.objectContaining({ email: 'student@example.test' }) })],
    }),
  }))
})

it('loads eligibility and document history exclusively for the resolved person', async () => {
  const { client, service } = setup('student')
  jest.mocked(resolveVerifiedPerson).mockResolvedValue({ id: personId, unresolved: false })
  const ownPerson = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({
    data: { display_name: 'Student', street: null, postal_code: null, city: null }, error: null,
  }) }
  const ownIssues = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), range: jest.fn().mockResolvedValue({ data: [], error: null }) }
  const original = client.from.getMockImplementation()
  client.from.mockImplementation((table: string) => (table === 'people' ? ownPerson : table === 'certificate_issues' ? ownIssues : original!(table)) as ReturnType<typeof client.from>)
  const invoices = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) }
  service.from.mockReturnValue(invoices)
  service.rpc.mockResolvedValue({ data: [], error: null })
  const result = await getStudentCertificateData()
  expect(result.success).toBe(true)
  expect(service.rpc).toHaveBeenCalledWith('certificate_eligibility', { p_person: personId })
  expect(ownPerson.eq).toHaveBeenCalledWith('id', personId)
  expect(ownIssues.eq).toHaveBeenCalledWith('person_id', personId)
  expect(invoices.eq).toHaveBeenCalledWith('external_customers.person_id', personId)
})

it('restricts staff eligibility inspection before accepting a person ID', async () => {
  setup('student')
  expect(await getStaffCertificateEligibility(personId)).toEqual({ success: false, error: 'not_authorized' })
  expect(createAdminClient).not.toHaveBeenCalled()
  setup('teacher')
  expect(await getStaffCertificateEligibility('invalid-person')).toEqual({ success: false, error: 'invalid_input' })
  expect(createAdminClient).not.toHaveBeenCalled()
})

it('lets a verified staff member inspect the explicitly selected student eligibility', async () => {
  const { service } = setup('teacher')
  service.rpc.mockResolvedValue({ data: [], error: null })
  expect(await getStaffCertificateEligibility(personId)).toEqual({ success: true, data: [] })
  expect(service.rpc).toHaveBeenCalledWith('certificate_eligibility', { p_person: personId })
})
