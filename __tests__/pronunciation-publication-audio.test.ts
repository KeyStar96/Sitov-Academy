jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/audio/neural-cache', () => ({ findCachedAudio: jest.fn(), neuralAudioPath: (text: string) => text }))
jest.mock('@/lib/audio/preparation-queue', () => ({ requestGermanAudioPreparation: jest.fn() }))

import { createClient } from '@/utils/supabase/server'
import { findCachedAudio } from '@/lib/audio/neural-cache'
import { requestGermanAudioPreparation } from '@/lib/audio/preparation-queue'
import { savePronunciationPrompt } from '@/app/actions/pronunciation'

const id = '00000000-0000-4000-8000-000000000001'
const input = { id, level: 'A1.1', title: 'Der Lehrer', text: 'Der Lehrer kommt morgen.', focus: '', isActive: true }

function setup(role = 'teacher') {
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { role }, error: null }) }
  const rpc = jest.fn()
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id } }, error: null }) }, from: jest.fn(() => query), rpc } as unknown as Awaited<ReturnType<typeof createClient>>)
  return rpc
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(findCachedAudio).mockResolvedValue(null)
})

test('a teacher sees missing_audio and a queued exact sentence before any write', async () => {
  const rpc = setup()
  expect(await savePronunciationPrompt(input)).toEqual({ success: false, reason: 'missing_audio' })
  expect(requestGermanAudioPreparation).toHaveBeenCalledWith(input.text)
  expect(rpc).not.toHaveBeenCalled()
})

test('learner requests never look up or enqueue authoring audio', async () => {
  const rpc = setup('student')
  expect(await savePronunciationPrompt(input)).toEqual({ success: false, reason: 'not_authenticated' })
  expect(findCachedAudio).not.toHaveBeenCalled()
  expect(requestGermanAudioPreparation).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
})
