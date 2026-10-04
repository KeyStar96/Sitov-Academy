import { submitEnrollment } from '@/app/actions/submit-enrollment'
import { createAdminClient } from '@/utils/supabase/admin'
import { rateLimit } from '@/lib/ratelimit'

jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn() }))
jest.mock('next/headers', () => ({ headers: async () => ({ get: () => null }) }))

const id = '00000000-0000-4000-8000-000000000001', secondId = '00000000-0000-4000-8000-000000000002'
const rpc = jest.fn(), lookup = jest.fn()
const query = { select: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), is: lookup }
const from = jest.fn(() => query)
const course = (type = 'presence', category = 'german', courseId = id) => ({ id: courseId, type, category, archived_at: null })
const data = { personal: { firstName: 'Test', lastName: 'Learner', email: 'learner@example.test', phone: '', birthDate: '01.01.1980', street: 'Teststraße 1', zip: '30159', city: 'Hannover' } }
const accepted = { privacy: true, agb: true, revocation: true }
const submit = (videoRecording?: boolean) => submitEnrollment(data, [{ courseId: id }], '05.10.2026', { ...accepted, videoRecording }, 'tr')

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(rateLimit).mockResolvedValue({ success: true, limit: 3, remaining: 2, reset: 0 })
  rpc.mockResolvedValue({ data: id, error: null })
  lookup.mockResolvedValue({ data: [course()], error: null })
  jest.mocked(createAdminClient).mockReturnValue({ from, rpc } as unknown as ReturnType<typeof createAdminClient>)
})

it.each(['german', 'speaking', 'online'])('requires affirmative recording for the persisted online %s group', async category => {
  lookup.mockResolvedValue({ data: [course('online', category)], error: null })
  for (const videoRecording of [false, undefined]) expect(await submit(videoRecording)).toEqual({ success: false, message: 'generic_error' })
  expect(rpc).not.toHaveBeenCalled()
  expect(await submit(true)).toEqual({ success: true, message: 'registration_success' })
  expect(from).toHaveBeenCalledWith('courses')
  expect(query.select).toHaveBeenCalledWith('id,type,category,archived_at')
  expect(query.in).toHaveBeenCalledWith('id', [id])
  expect(lookup).toHaveBeenCalledWith('archived_at', null)
  expect(rpc).toHaveBeenCalledWith('submit_business_registration', expect.objectContaining({
    p_consents: { ...accepted, recording: true }, p_trial: false, p_locale: 'tr',
  }))
})

const exceptions = [['online', 'private'], ...['german', 'speaking', 'online', 'private'].map(category => ['presence', category])]
it.each(exceptions)('preserves false, true and unset recording for %s/%s exceptions', async (type, category) => {
  lookup.mockResolvedValue({ data: [course(type, category)], error: null })
  for (const videoRecording of [false, true, undefined]) {
    expect(await submit(videoRecording)).toEqual({ success: true, message: 'registration_success' })
    expect(rpc).toHaveBeenLastCalledWith('submit_business_registration', expect.objectContaining({
      p_consents: { ...accepted, recording: videoRecording ?? null }, p_trial: false, p_locale: 'tr',
    }))
  }
})

it('requires recording when an online group is selected together with private courses', async () => {
  lookup.mockResolvedValue({ data: [course('online', 'private'), course('online', 'speaking', secondId)], error: null })
  const selections = [{ courseId: id, requestedUnits: 2 }, { courseId: secondId }]
  expect(await submitEnrollment(data, selections, '05.10.2026', { ...accepted, videoRecording: false })).toEqual({ success: false, message: 'generic_error' })
  expect(rpc).not.toHaveBeenCalled()
  expect(await submitEnrollment(data, selections, '05.10.2026', { ...accepted, videoRecording: true })).toEqual({ success: true, message: 'registration_success' })
  expect(query.in).toHaveBeenLastCalledWith('id', [id, secondId])
})

it.each([
  { data: null, error: { message: 'Private query failure' } },
  { data: [], error: null },
  { data: [course('online', 'private', secondId)], error: null },
  { data: [course(), course()], error: null },
  { data: [{ ...course(), archived_at: '2026-10-04T10:00:00Z' }], error: null },
  { data: [course('unexpected', 'private')], error: null },
  { data: [course('online', 'unknown')], error: null },
  { data: [{ ...course(), category: null }], error: null },
])('fails closed on missing, malformed, archived or mismatched persisted courses: %#', async result => {
  lookup.mockResolvedValue(result)
  expect(await submit(true)).toEqual({ success: false, message: 'generic_error' })
  expect(rpc).not.toHaveBeenCalled()
})

it('rejects a partially missing multi-course selection even when recording is accepted', async () => {
  expect(await submitEnrollment(data, [{ courseId: id }, { courseId: secondId }], '05.10.2026', { ...accepted, videoRecording: true })).toEqual({ success: false, message: 'generic_error' })
  expect(rpc).not.toHaveBeenCalled()
})

it.each(['privacy', 'agb'] as const)('still requires %s independently before privileged database access', async legalConsent => {
  expect(await submitEnrollment(data, [{ courseId: id }], '05.10.2026', { ...accepted, [legalConsent]: false, videoRecording: true })).toEqual({ success: false, message: 'generic_error' })
  expect(createAdminClient).not.toHaveBeenCalled()
})
