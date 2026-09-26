import { learningVideoDestination } from '@/lib/learning-video-redirect'
import { currentUserHasTrainerAccess } from '@/lib/access/server'
import { createClient } from '@/utils/supabase/server'

jest.mock('@/lib/access/server', () => ({ currentUserHasTrainerAccess: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
beforeEach(() => jest.resetAllMocks())

test('unauthorized bookmarks never query a protected video source', async () => {
  jest.mocked(currentUserHasTrainerAccess).mockResolvedValue(false)
  expect(await learningVideoDestination('en', 'A1.1', 'video-id')).toBe('/en/dashboard/level/A1.1/videos')
  expect(createClient).not.toHaveBeenCalled()
})

test.each([
  ['https://www.youtube.com/watch?v=abcdefghijk', 'https://www.youtube.com/watch?v=abcdefghijk'],
  ['javascript:alert(1)', '/en/dashboard/level/A1.1/videos'],
  [null, '/en/dashboard/level/A1.1/videos'],
])('authorized source %s resolves safely', async (source, expected) => {
  jest.mocked(currentUserHasTrainerAccess).mockResolvedValue(true)
  const query = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn().mockResolvedValue({ data: { source_url: source }, error: null }) }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  jest.mocked(createClient).mockResolvedValue({ from: () => query } as never)
  expect(await learningVideoDestination('en', 'A1.1', 'video-id')).toBe(expected)
  expect(currentUserHasTrainerAccess).toHaveBeenCalledWith('A1.1', 'videos')
  expect(query.eq.mock.calls).toEqual([['id', 'video-id'], ['unit.level', 'A1.1'], ['unit.is_active', true]])
})
