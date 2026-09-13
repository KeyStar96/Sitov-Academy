/** @jest-environment node */
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/utils/stripe/server', () => ({ stripe: {
  webhooks: { constructEvent: jest.fn() }, subscriptions: { retrieve: jest.fn() },
} }))
import { POST } from '@/app/api/webhooks/stripe/route'
import { createAdminClient } from '@/utils/supabase/admin'
import { stripe } from '@/utils/stripe/server'
import type Stripe from 'stripe'

const originalSecret = process.env.STRIPE_SECRET_KEY
const originalWebhook = process.env.STRIPE_WEBHOOK_SECRET
const update = jest.fn()
const event = (type: string, object: object) => ({ type, data: { object } }) as Stripe.Event
const request = (signature: string | null = 'signed-test') => new Request('https://school.example/api/webhooks/stripe', {
  method: 'POST', body: '{}', headers: signature ? { 'Stripe-Signature': signature } : {},
})
beforeEach(() => {
  jest.clearAllMocks()
  process.env.STRIPE_SECRET_KEY = 'test-only-secret'
  process.env.STRIPE_WEBHOOK_SECRET = 'test-only-signature-key'
  update.mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) })
  jest.mocked(createAdminClient).mockReturnValue({ from: () => ({ update }) } as unknown as ReturnType<typeof createAdminClient>)
})
afterEach(() => {
  if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY
  else process.env.STRIPE_SECRET_KEY = originalSecret
  if (originalWebhook === undefined) delete process.env.STRIPE_WEBHOOK_SECRET
  else process.env.STRIPE_WEBHOOK_SECRET = originalWebhook
})
it('disables unconfigured webhooks before invoking the payment or database client', async () => {
  delete process.env.STRIPE_WEBHOOK_SECRET
  expect((await POST(request())).status).toBe(503)
  expect(stripe.webhooks.constructEvent).not.toHaveBeenCalled()
  expect(createAdminClient).not.toHaveBeenCalled()
})
it('does not create a privileged client for unsigned or invalid events', async () => {
  expect((await POST(request(null))).status).toBe(400)
  jest.mocked(stripe.webhooks.constructEvent).mockImplementation(() => { throw new Error('Invalid') })
  expect((await POST(request())).status).toBe(400)
  expect(createAdminClient).not.toHaveBeenCalled()
})
it('does not activate an account for a one-time payment', async () => {
  jest.mocked(stripe.webhooks.constructEvent).mockReturnValue(event('checkout.session.completed', { mode: 'payment', metadata: { supabase_user_id: 'user-id' } }))
  expect((await POST(request())).status).toBe(200)
  expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled()
  expect(update).not.toHaveBeenCalled()
})
it('uses current subscription state when a completed checkout arrives after cancellation', async () => {
  jest.mocked(stripe.webhooks.constructEvent).mockReturnValue(event('checkout.session.completed', {
    mode: 'subscription', subscription: { id: 'sub_test' }, metadata: { supabase_user_id: 'user-id' },
  }))
  jest.mocked(stripe.subscriptions.retrieve).mockResolvedValue({ id: 'sub_test', customer: { id: 'cus_test' }, status: 'canceled' } as unknown as Awaited<ReturnType<typeof stripe.subscriptions.retrieve>>)
  expect((await POST(request())).status).toBe(200)
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: 'kostenlos', stripe_customer_id: 'cus_test', stripe_subscription_id: 'sub_test' }))
})
