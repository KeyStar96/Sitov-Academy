import { getExercises } from '@/app/actions/exercises'
import { createClient } from '@/utils/supabase/server'
import { readAllRows } from '@/lib/supabase-read'
import { loadLevelAccessProfile } from '@/lib/access/server'

jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase-read', () => ({ readAllRows: jest.fn() }))
jest.mock('@/lib/access/server', () => ({ loadLevelAccessProfile: jest.fn() }))
jest.mock('@/lib/access/levels', () => ({ ...jest.requireActual('@/lib/access/levels'), hasTrainerAccess: () => true, getAllowedLessons: () => null }))

const id = '00000000-0000-4000-8000-000000000001'
const content = { target_form: ['heißen'], text_before: '', text_after: '', correct_answer: 'Wie heißen Sie?',
  options: ['Wie heißen Sie?', 'Wie wohnen Sie?'], accepted_answers: ['Wie heißen Sie?'] }
const { target_form: _targetForm, ...legacyContent } = content
const row = {
  id, unit_id: id, topic: 'Sich vorstellen', type: 'fill_in_blank', content, content_status: 'ready',
  solution_audio_url: null, created_at: null,
  unit: { id, level: 'A1.1', label: '01', sort_order: 1, is_active: true },
  translations: [{ exercise_id: id, locale: 'ru', prompt: 'Как вас зовут?', hint: null, smart_hint: null, explanation: null }],
}

function setup(rows: unknown[]) {
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: [], error: null }) }
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id } } }) },
    from: jest.fn().mockReturnValue(query) } as unknown as Awaited<ReturnType<typeof createClient>>)
  jest.mocked(loadLevelAccessProfile).mockResolvedValue({ role: 'student' } as Awaited<ReturnType<typeof loadLevelAccessProfile>>)
  jest.mocked(readAllRows).mockResolvedValueOnce(rows).mockResolvedValueOnce([])
}
beforeEach(() => jest.resetAllMocks())

it('delivers only complete content with the selected locale prompt and explicit target forms', async () => {
  setup([row, { ...row, id: 'missing', content: legacyContent },
    { ...row, id: 'empty', content: { ...content, target_form: [] } },
    { ...row, id: 'blank', content: { ...content, target_form: [' '] } },
    { ...row, id: 'invalid', content_status: 'incomplete' }])
  const exercises = await getExercises('A1.1', 'ru')
  expect(exercises).toHaveLength(1)
  expect(exercises[0]).toMatchObject({ id, translationPrompt: 'Как вас зовут?', promptLanguage: 'ru', content: { target_form: ['heißen'] } })
})

it('does not fall back to another language when a translation prompt is missing', async () => {
  setup([row])
  expect(await getExercises('A1.1', 'uk')).toEqual([])
})

it('keeps complete German grammar exercises without translation prompts available', async () => {
  setup([{ ...row, translations: [], content: { ...content, text_before: 'Wie ', text_after: ' Sie?', correct_answer: 'heißen' } }])
  const exercises = await getExercises('A1.1', 'uk')
  expect(exercises).toHaveLength(1)
  expect(exercises[0]).not.toHaveProperty('translationPrompt')
})
