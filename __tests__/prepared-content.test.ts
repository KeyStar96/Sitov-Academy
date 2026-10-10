import { preparedLearningAudioTexts, requirePreparedGermanAudio, SITOV_PREPARED_AUDIO_REQUIRED, SitovPreparedAudioRequiredError } from '@/lib/audio/prepared-content'
import { findCachedAudio, neuralAudioPath } from '@/lib/audio/neural-cache'
import { saveLearningContent } from '@/lib/learning-writes'
import { requestGermanAudioPreparation } from '@/lib/audio/preparation-queue'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/supabase/database.types'

jest.mock('@/lib/audio/neural-cache', () => ({ findCachedAudio: jest.fn(), neuralAudioPath: jest.fn(text => text) }))
jest.mock('@/lib/audio/preparation-queue', () => ({ requestGermanAudioPreparation: jest.fn() }))

const id = '00000000-0000-4000-8000-000000000001'
const prepared = (text: string) => ({ audioUrl: 'https://example.test/prepared.mp3', wordTimings: text.split(/\s+/u).map((_, index) => ({ start: index + 0.35, end: index + 1.35 })) })
const grammar = { level: 'A1.1', lesson: '01', topic: 'Artikel', type: 'fill_in_blank', content: { text_before: '', correct_answer: 'Der', text_after: ' Tisch.' } }

function client() {
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: null }) }
  const value = { rpc: jest.fn().mockResolvedValue({ data: { id }, error: null }), from: jest.fn(() => query) }
  return { value, typed: value as unknown as SupabaseClient<Database> }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(findCachedAudio).mockImplementation(async text => prepared(text))
})

test('extracts the exact filled word/sentence and multiple-choice speech requested by the UI', () => {
  expect(preparedLearningAudioTexts('exercises', grammar)).toEqual(['Der', 'Der Tisch.'])
  expect(preparedLearningAudioTexts('exercises', { type: 'multiple_choice', content: { question: 'Das ist ___ Tisch.', correct_answer: 'ein' } })).toEqual(['Das ist ein Tisch.'])
  expect(preparedLearningAudioTexts('exercises', { type: 'multiple_choice', content: { question: 'Wie heißt du?', correct_answer: 'Ich heiße Jan.' } })).toEqual(['Wie heißt du? Ich heiße Jan.'])
})

test('extracts German vocabulary contexts and reading text without translations or grading metadata', () => {
  expect(preparedLearningAudioTexts('vocabulary', { word_de: '  Tür ', article: 'die', context_sentence_de: 'Die Tür ist offen.', context_sentence_en: 'The door is open.', target_form: ['Akkusativ'] })).toEqual(['die Tür', 'Die Tür ist offen.'])
  expect(preparedLearningAudioTexts('pronunciation', { sentence_de: 'Äpfel\n sind süß.' })).toEqual(['Äpfel sind süß.'])
  expect(preparedLearningAudioTexts('videos', { title: 'Ein Video' })).toEqual([])
})

test('normalizes/de-duplicates lookups and only accepts complete measured word timings', async () => {
  const result = await requirePreparedGermanAudio([' Guten\nMorgen! ', 'Guten Morgen!'])
  expect(result.size).toBe(1)
  expect(neuralAudioPath).toHaveBeenCalledWith('Guten Morgen!', 'de')
  expect(findCachedAudio).toHaveBeenCalledTimes(1)
  jest.mocked(findCachedAudio).mockResolvedValueOnce({ audioUrl: '/legacy.mp3', wordTimings: [{ start: 0, end: 1 }] })
  await expect(requirePreparedGermanAudio(['Guten Morgen!'])).rejects.toMatchObject({ code: SITOV_PREPARED_AUDIO_REQUIRED })
})

test('vocabulary publication includes the spoken usage chunk and queues a missing chunk before mutation', async () => {
  const vocabulary = { level: 'A2.1', lesson: '01', word_de: 'Termin', article: 'der', chunk_de: 'einen Termin vereinbaren', context_sentence_de: 'Ich möchte einen Termin vereinbaren.' }
  expect(preparedLearningAudioTexts('vocabulary', vocabulary)).toEqual(['der Termin', 'einen Termin vereinbaren', 'Ich möchte einen Termin vereinbaren.'])
  const { value, typed } = client()
  jest.mocked(findCachedAudio).mockImplementation(async text => text === vocabulary.chunk_de ? null : prepared(text))
  await expect(saveLearningContent(typed, 'vocabulary', vocabulary, id)).rejects.toMatchObject({ code: SITOV_PREPARED_AUDIO_REQUIRED })
  expect(value.rpc).not.toHaveBeenCalled()
  expect(requestGermanAudioPreparation).toHaveBeenCalledTimes(1)
  expect(requestGermanAudioPreparation).toHaveBeenCalledWith(vocabulary.chunk_de)
})

test('missing prepared audio rejects active publication before the content RPC', async () => {
  const { value, typed } = client()
  jest.mocked(findCachedAudio).mockResolvedValue(null)
  await expect(saveLearningContent(typed, 'exercises', grammar, id)).rejects.toMatchObject({ code: SITOV_PREPARED_AUDIO_REQUIRED })
  expect(value.rpc).not.toHaveBeenCalled()
  expect(requestGermanAudioPreparation).toHaveBeenCalledWith('Der')
  expect(requestGermanAudioPreparation).toHaveBeenCalledWith('Der Tisch.')
})

test('a database publication guard maps back to the same typed authoring error', async () => {
  const { value, typed } = client()
  value.rpc.mockResolvedValueOnce({ data: { error: SITOV_PREPARED_AUDIO_REQUIRED, message: 'Prepare the audio first.', sqlstate: '22023' }, error: null })
  await expect(saveLearningContent(typed, 'exercises', grammar, id)).rejects.toBeInstanceOf(SitovPreparedAudioRequiredError)
  expect(value.rpc).toHaveBeenCalledTimes(1)
  expect(value.from).not.toHaveBeenCalled()
})

test('queues every missing text across batches while leaving already prepared audio alone', async () => {
  jest.mocked(findCachedAudio).mockImplementation(async text => text === 'bereit' ? prepared(text) : null)
  const texts = Array.from({ length: 12 }, (_, index) => `Text ${index}`)
  await expect(requirePreparedGermanAudio([...texts, 'bereit', texts[0]])).rejects.toMatchObject({ code: SITOV_PREPARED_AUDIO_REQUIRED })
  expect(requestGermanAudioPreparation).toHaveBeenCalledTimes(12)
  for (const text of texts) expect(requestGermanAudioPreparation).toHaveBeenCalledWith(text)
  expect(requestGermanAudioPreparation).not.toHaveBeenCalledWith('bereit')
})

test('a draft can be stored before preparation and activation requires the assets', async () => {
  const { value, typed } = client()
  // A catalog read after the RPC deliberately fails: the mutation boundary is
  // what this test observes, rather than reconstructing a catalog row fixture.
  await expect(saveLearningContent(typed, 'exercises', { ...grammar, is_active: false }, id)).rejects.toThrow()
  expect(value.rpc).toHaveBeenCalledTimes(1)
  expect(findCachedAudio).not.toHaveBeenCalled()
  value.rpc.mockClear()
  jest.mocked(findCachedAudio).mockResolvedValue(null)
  await expect(saveLearningContent(typed, 'exercises', { ...grammar, is_active: true }, id)).rejects.toMatchObject({ code: SITOV_PREPARED_AUDIO_REQUIRED })
  expect(value.rpc).not.toHaveBeenCalled()
})

test('the database assigns prepared references and explicit teacher references reach its atomic guard', async () => {
  const { value, typed } = client()
  const vocabulary = { level: 'A1.1', lesson: '01', word_de: 'Tür', article: 'die' }
  await expect(saveLearningContent(typed, 'vocabulary', vocabulary)).rejects.toThrow()
  expect(value.rpc.mock.calls[0][1].p_payload.fields).not.toHaveProperty('audio_url')
  const recording = 'https://example.test/teacher-recording.mp3'
  await expect(saveLearningContent(typed, 'vocabulary', { ...vocabulary, audio_url: recording }, id)).rejects.toThrow()
  expect(value.rpc.mock.calls[1][1].p_payload.fields.audio_url).toBe(recording)
})

test('accepts validated spoken clock groups without display timings', async () => {
  jest.mocked(findCachedAudio).mockResolvedValue({ audioUrl: '/clock', spokenAlignment: { version: 1, displayText: '5:30 Uhr', spokenText: 'fünf Uhr dreißig', groups: [{ display: [0, 2], spoken: [0, 3] }] }, spokenWordTimings: [0, 1, 2].map(start => ({ start, end: start + .5 })) })
  expect((await requirePreparedGermanAudio(['5:30 Uhr'])).size).toBe(1)
  expect(requestGermanAudioPreparation).not.toHaveBeenCalled()
})
