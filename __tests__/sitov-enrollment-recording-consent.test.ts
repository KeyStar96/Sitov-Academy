import { submitEnrollment } from '@/app/actions/submit-enrollment'
import { createAdminClient } from '@/utils/supabase/admin'
import { rateLimit } from '@/lib/ratelimit'

jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn() }))
jest.mock('next/headers', () => ({ headers: async () => ({ get: () => null }) }))

const id = '00000000-0000-4000-8000-000000000001'
const rpc = jest.fn()
const data = { personal: { firstName: 'Test', lastName: 'Learner', email: 'learner@example.test', phone: '', birthDate: '01.01.1980', street: 'Teststraße 1', zip: '30159', city: 'Hannover' } }

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(rateLimit).mockResolvedValue({ success: true, limit: 3, remaining: 2, reset: 0 })
  rpc.mockResolvedValue({ data: id, error: null })
  jest.mocked(createAdminClient).mockReturnValue({ rpc } as unknown as ReturnType<typeof createAdminClient>)
})

it.each([false, true, undefined])('passes the independent recording choice to the atomic registration RPC: %s', async videoRecording => {
  expect(await submitEnrollment(data, [{ courseId: id }], '05.10.2026', { privacy: true, agb: true, revocation: true, videoRecording }, 'tr'))
    .toEqual({ success: true, message: 'registration_success' })
  expect(rpc).toHaveBeenCalledWith('submit_business_registration', expect.objectContaining({
    p_consents: { privacy: true, agb: true, revocation: true, recording: videoRecording ?? null },
    p_trial: false, p_locale: 'tr',
  }))
})

it('still rejects missing required privacy acceptance before privileged database access', async () => {
  expect(await submitEnrollment(data, [{ courseId: id }], '05.10.2026', { privacy: false, agb: true, revocation: true, videoRecording: false }))
    .toEqual({ success: false, message: 'generic_error' })
  expect(createAdminClient).not.toHaveBeenCalled()
})
