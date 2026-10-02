/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/daily-quest-server', () => ({ resolveDailyQuestLoginTarget: jest.fn() }))

import { NextRequest } from 'next/server'
import { GET } from '@/app/auth/confirm/route'
import { createClient } from '@/utils/supabase/server'
import { resolveDailyQuestLoginTarget } from '@/lib/daily-quest-server'

const verified = { data: { user: { id: 'verified-student' } }, error: null }
const verifyOtp = jest.fn()
const exchangeCodeForSession = jest.fn()
const client = { auth: { verifyOtp, exchangeCodeForSession } }
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createClient).mockResolvedValue(client as never)
  verifyOtp.mockResolvedValue(verified); exchangeCodeForSession.mockResolvedValue(verified)
  jest.mocked(resolveDailyQuestLoginTarget).mockImplementation(async input => input.nextPath === '/de/dashboard' ? '/de/dashboard/daily-quest' : input.nextPath)
})
const request = (query: string) => new NextRequest(`http://localhost:3000/auth/confirm?lang=de&${query}`, { headers: { host: 'localhost:3000' } })

it.each(['code=valid-pkce', 'token_hash=valid-otp&type=signup'])('offers the daily quest after successful verification %s', async query => {
  const response = await GET(request(query))
  const target = new URL(response.headers.get('location')!)
  expect(target.pathname).toBe('/de/dashboard/daily-quest')
  expect(target.searchParams.get('status')).toBe('confirm_success')
  expect(resolveDailyQuestLoginTarget).toHaveBeenCalledWith({ supabase: client, userId: 'verified-student', lang: 'de', nextPath: '/de/dashboard' })
})

it.each(['token_hash=valid-otp&type=recovery', 'code=valid-pkce&next=%2Fde%2Freset-password'])('keeps recovery out of the daily switch %s', async query => {
  const response = await GET(request(query))
  const target = new URL(response.headers.get('location')!)
  expect(target.pathname).toBe('/de/reset-password')
  expect(target.searchParams.has('status')).toBe(false)
  expect(resolveDailyQuestLoginTarget).not.toHaveBeenCalled()
})

it('preserves an explicit learning destination after verification', async () => {
  const path = '/ru/dashboard/level/A1.2/path?lesson=2#task'
  const response = await GET(request(`code=valid-pkce&next=${encodeURIComponent(path)}`))
  const target = new URL(response.headers.get('location')!)
  expect(target.pathname).toBe('/ru/dashboard/level/A1.2/path')
  expect(target.searchParams.get('lesson')).toBe('2')
  expect(target.hash).toBe('#task')
})

it('does not claim a day when verification fails', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  verifyOtp.mockResolvedValue({ data: { user: null }, error: { message: 'private' } })
  try {
    const response = await GET(request('token_hash=invalid&type=signup'))
    expect(new URL(response.headers.get('location')!).pathname).toBe('/de/login')
    expect(resolveDailyQuestLoginTarget).not.toHaveBeenCalled()
  } finally { log.mockRestore() }
})
