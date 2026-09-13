import { createClient } from '@/utils/supabase/server'
import { saveGrammarExercise } from '@/app/actions/grammar-cms'
import { grammarWriteSchema } from '@/lib/grammar-validation'

jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

const id = '00000000-0000-4000-8000-000000000001'
const input = grammarWriteSchema.parse({
  level: 'A1.1', lesson: 'A1.1 · 01', topic: 'Artikel', type: 'fill_in_blank', solution_audio_url: null,
  hint: { ru: 'Vergleich Russisch', uk: 'Vergleich Ukrainisch' },
  content: { text_before: '', text_after: ' Tisch.', correct_answer: 'Der', options: ['Der', 'Die', 'Das'], alternative_answers: ['Dieser'], smart_hint: { de: 'Erklärung', en: 'Explanation', ru: 'Объяснение' } },
})

function setup(role: string) {
  const profile = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { role }, error: null }) }
  const write = { insert: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { id, ...input, created_at: null }, error: null }) }
  const client = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id } }, error: null }) },
    from: jest.fn((table: string) => table === 'profiles' ? profile : write),
  }
  jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  return { client, write }
}

beforeEach(() => jest.clearAllMocks())

test('teacher updates use the existing JSONB columns and preserve localized hints plus accepted alternatives', async () => {
  const { write } = setup('teacher')
  expect(await saveGrammarExercise(input, id)).toMatchObject({ success: true })
  expect(write.update).toHaveBeenCalledWith(expect.objectContaining({ hint: input.hint, content: input.content }))
  expect(write.update.mock.calls[0][0]).not.toHaveProperty('hint_ru')
  expect(write.update.mock.calls[0][0]).not.toHaveProperty('hint_tr')
  expect(write.eq).toHaveBeenCalledWith('id', id)
})

test('students cannot write authored grammar content', async () => {
  const { write } = setup('student')
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    expect(await saveGrammarExercise(input, id)).toEqual({ success: false, error: 'failed' })
    expect(write.update).not.toHaveBeenCalled()
    expect(write.insert).not.toHaveBeenCalled()
  } finally { log.mockRestore() }
})

test('invalid alternate answers are rejected before any database request', async () => {
  const invalid = { ...input, type: 'fill_in_blank' as const, content: { text_before: '', text_after: ' Tisch.', correct_answer: 'Der', options: ['Der', 'Die'], alternative_answers: [' DER '] } }
  expect(await saveGrammarExercise(invalid, id)).toEqual({ success: false, error: 'invalid' })
  expect(createClient).not.toHaveBeenCalled()
})
