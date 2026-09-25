/** @jest-environment node */
import { NextRequest } from 'next/server'
import { GET } from '@/app/auth/confirm/route'
import { createClient } from '@/utils/supabase/server'

jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
const verifyOtp = jest.fn().mockResolvedValue({ error: null })
const exchangeCodeForSession = jest.fn().mockResolvedValue({ error: null })
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createClient).mockResolvedValue({ auth: { verifyOtp, exchangeCodeForSession } } as never)
})

it.each(['token_hash=fixture-token&type=signup', 'code=fixture-code'])('carries the visible confirmation status to Home (%s)', async query => {
  const response = await GET(new NextRequest(`http://localhost:3000/auth/confirm?lang=de&${query}`, { headers: { host: 'localhost:3000' } }))
  const target = new URL(response.headers.get('location')!)
  expect(target.pathname).toBe('/de/dashboard')
  expect(target.searchParams.get('status')).toBe('confirm_success')
})

it('retains password recovery without a registration status', async () => {
  const response = await GET(new NextRequest('http://localhost:3000/auth/confirm?lang=de&token_hash=fixture-token&type=recovery', { headers: { host: 'localhost:3000' } }))
  const target = new URL(response.headers.get('location')!)
  expect(target.pathname).toBe('/de/reset-password')
  expect(target.searchParams.has('status')).toBe(false)
})
