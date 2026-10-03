jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
import { hasConfirmedCourseRegistration } from '@/lib/profile-monthly-access'
import type { createClient } from '@/utils/supabase/server'

function client(data: { id: string } | null, error: { code: string } | null = null) {
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), neq: jest.fn().mockReturnThis(), or: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data, error }) }
  return { query, db: { from: jest.fn().mockReturnValue(query) } as unknown as Awaited<ReturnType<typeof createClient>> }
}
it('requires the owner’s confirmed original registration, with no trial or monthly fallback', async () => {
  const { query, db } = client({ id: 'registration' })
  expect(await hasConfirmedCourseRegistration(db, 'verified-person')).toBe(true)
  expect(query.eq.mock.calls).toEqual([['person_id', 'verified-person'], ['kind', 'registration']])
  expect(query.neq).toHaveBeenCalledWith('status', 'rejected')
  expect(query.or).toHaveBeenCalledWith('status.eq.confirmed,confirmed_at.not.is.null')
  expect(await hasConfirmedCourseRegistration(client(null).db, 'verified-person')).toBe(false)
})
it('fails closed when the registration check is unavailable', async () => {
  await expect(hasConfirmedCourseRegistration(client(null, { code: '42501' }).db, 'verified-person')).rejects.toThrow('not_authorized')
})
