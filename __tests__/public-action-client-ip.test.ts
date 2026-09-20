/** @jest-environment node */
jest.mock('next/headers', () => ({ headers: jest.fn() }))
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn() }))
import { headers } from 'next/headers'
import { rateLimit } from '@/lib/ratelimit'
import { createAdminClient } from '@/utils/supabase/admin'
import { submitTrialLesson } from '@/app/actions/submit-trial'
import { submitCancellation } from '@/app/actions/submit-cancellation'
import { submitEnrollment } from '@/app/actions/submit-enrollment'
const id = '00000000-0000-4000-8000-000000000001'
const contact = { firstName: 'Test', lastName: 'Learner', email: 'test@example.test', birthDate: '01.01.1980', street: 'Teststraße 1', zip: '30165', city: 'Hannover' }
const original = process.env.TRUSTED_PROXY_HOPS
beforeEach(() => { jest.clearAllMocks(); process.env.TRUSTED_PROXY_HOPS = '1'; jest.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, limit: 3, reset: Date.now() }) })
afterAll(() => { if (original === undefined) delete process.env.TRUSTED_PROXY_HOPS; else process.env.TRUSTED_PROXY_HOPS = original })
it.each([
  ['trial', () => submitTrialLesson({ ...contact, courseId: id, trialDate: '2026-10-05', privacyAccepted: true, agbAccepted: true })],
  ['cancel', () => submitCancellation({ fullName: 'Test Learner', email: contact.email, courseId: id, terminationDate: 'asap' }, 'de')],
  ['enrollment', () => submitEnrollment({ personal: contact }, [{ courseId: id }], '01.10.2026', { privacy: true, agb: true, revocation: false })],
] as const)('%s uses the trusted client consistently and never writes after denial', async (scope, action) => {
  for (const chain of ['198.51.100.23, 10.0.2.5', '1.2.3.4, 198.51.100.23, 10.0.2.5', '203.0.113.9, 10.0.2.5']) {
    jest.mocked(headers).mockResolvedValue(new Headers({ 'x-forwarded-for': chain }) as never)
    expect((await action()).success).toBe(false)
  }
  expect(jest.mocked(rateLimit).mock.calls.map(call => call[0])).toEqual([`${scope}:198.51.100.23`, `${scope}:198.51.100.23`, `${scope}:203.0.113.9`])
  expect(createAdminClient).not.toHaveBeenCalled()
})
