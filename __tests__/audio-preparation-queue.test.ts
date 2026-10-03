jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))

import { createAdminClient } from '@/utils/supabase/admin'
import { requestGermanAudioPreparation } from '@/lib/audio/preparation-queue'
import { neuralAudioPath, SITOV_QWEN_PROFILE_FINGERPRINT } from '@/lib/audio/neural-identity'

const upsert = jest.fn()
const from = jest.fn(() => ({ upsert }))
beforeEach(() => {
  jest.clearAllMocks()
  upsert.mockResolvedValue({ error: null })
  jest.mocked(createAdminClient).mockReturnValue({ from } as unknown as ReturnType<typeof createAdminClient>)
})

test('uses the canonical normalized profile identity and preserves completed duplicate jobs', async () => {
  await requestGermanAudioPreparation('  die Tu\u0308r\n ')
  expect(from).toHaveBeenCalledWith('sitov_audio_preparation_requests')
  expect(upsert).toHaveBeenCalledWith({ cache_path: neuralAudioPath('die Tür', 'de'), text: 'die Tür', profile_fingerprint: SITOV_QWEN_PROFILE_FINGERPRINT }, { onConflict: 'cache_path', ignoreDuplicates: true })
  expect(upsert.mock.calls[0][0]).not.toHaveProperty('status')
})

test.each(['', ' '.repeat(4), 'a'.repeat(3001), 'Text\u0000'])('invalid requests never create a service client', async text => {
  await expect(requestGermanAudioPreparation(text)).rejects.toThrow('invalid_audio_preparation_text')
  expect(createAdminClient).not.toHaveBeenCalled()
})

test('queue outages fail closed without exposing the requested text', async () => {
  upsert.mockResolvedValue({ error: { message: 'internal detail' } })
  await expect(requestGermanAudioPreparation('das Brot')).rejects.toThrow('audio_preparation_queue_unavailable')
})
