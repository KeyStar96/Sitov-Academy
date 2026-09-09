/** @jest-environment node */
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/utils/stripe/server', () => ({ stripe: {
  customers: { create: jest.fn() }, checkout: { sessions: { create: jest.fn() } },
} }))
jest.mock('@/lib/site-url', () => ({ getSiteUrl: async () => 'https://example.invalid', buildSiteUrl: () => 'https://example.invalid/de/dashboard' }))

import { POST } from '@/app/api/stripe/checkout/route'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { stripe } from '@/utils/stripe/server'

function setup(signedIn = true, updateError: { code: string } | null = null) {
  const profile = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { email: 'test@example.invalid', stripe_customer_id: null }, error: null }) }
  const client = { auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'trusted-user-id' } : null }, error: null }) }, from: jest.fn(() => profile) }
  const billing = { update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { id: 'trusted-user-id' }, error: updateError }) }
  jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  jest.mocked(createAdminClient).mockReturnValue({ from: jest.fn(() => billing) } as unknown as ReturnType<typeof createAdminClient>)
  // Stripe's real return types include Response metadata irrelevant to this boundary test.
  jest.mocked(stripe.customers.create).mockResolvedValue({ id: 'cus_server_generated' } as unknown as Awaited<ReturnType<typeof stripe.customers.create>>)
  jest.mocked(stripe.checkout.sessions.create).mockResolvedValue({ url: 'https://checkout.stripe.com/test' } as unknown as Awaited<ReturnType<typeof stripe.checkout.sessions.create>>)
  return { billing }
}
const request = () => new Request('https://example.invalid/api/stripe/checkout', { method: 'POST' })
beforeEach(() => jest.clearAllMocks())

it('does not invoke privileged writes without a session', async () => {
  setup(false)
  expect((await POST(request())).status).toBe(401)
  expect(createAdminClient).not.toHaveBeenCalled()
})
it('stores only Stripe-generated customer ID for the authenticated user', async () => {
  const { billing } = setup()
  expect((await POST(request())).status).toBe(200)
  expect(billing.update).toHaveBeenCalledWith({ stripe_customer_id: 'cus_server_generated' })
  expect(billing.eq).toHaveBeenCalledWith('id', 'trusted-user-id')
  expect(stripe.checkout.sessions.create).toHaveBeenCalled()
})
it('does not create a checkout session if the billing profile write fails', async () => {
  setup(true, { code: '42501' })
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    expect((await POST(request())).status).toBe(500)
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
  } finally { log.mockRestore() }
})
