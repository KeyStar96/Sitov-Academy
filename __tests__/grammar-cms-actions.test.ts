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
  const { smart_hint, ...content } = input.type === 'fill_in_blank' ? input.content : { ...input.content, smart_hint: undefined }
  const row = { id, unit_id: id, topic: input.topic, type: input.type, solution_audio_url: null, content, created_at: null,
    unit: { id, level: input.level, label: input.lesson, sort_order: 1, is_active: true },
    translations: ['de', 'en', 'ru', 'uk', 'tr'].map(locale => ({ exercise_id: id, locale, hint: input.hint?.[locale] ?? null, smart_hint: typeof smart_hint === 'object' && smart_hint !== null ? smart_hint[locale] ?? null : null, explanation: null })),
  }
  const write = { insert: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: row, error: null }) }
  const client = {
    rpc: jest.fn().mockResolvedValue({ data: { id }, error: null }),
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id } }, error: null }) },
    from: jest.fn((table: string) => table === 'profiles' ? profile : write),
  }
  jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  return { client, write }
}

beforeEach(() => jest.clearAllMocks())

test('teacher updates preserve localized hints and alternatives through the normalized writer', async () => {
  const { client, write } = setup('teacher')
  expect(await saveGrammarExercise(input, id)).toMatchObject({ success: true, data: { hint: input.hint, content: input.content } })
  expect(client.rpc).toHaveBeenCalledWith('save_learning_content', { p_trainer: 'exercises', p_id: id, p_payload: { unit: { level: input.level, label: input.lesson }, fields: expect.objectContaining({ content: expect.objectContaining({ correct_answer: 'Der', alternative_answers: ['Dieser'] }) }), translations: expect.arrayContaining([{ locale: 'ru', hint: 'Vergleich Russisch', smart_hint: 'Объяснение', explanation: null }, { locale: 'uk', hint: 'Vergleich Ukrainisch', smart_hint: null, explanation: null }]) } })
  expect(client.rpc.mock.calls[0][1].p_payload.fields.content).not.toHaveProperty('smart_hint')
  expect(client.from).toHaveBeenCalledWith('learning_exercises')
  expect(write.update).not.toHaveBeenCalled()
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
  const invalid = { ...input, type: 'fill_in_blank' as const, content: { text_before: '', text_after: ' Tisch.', correct_answer: 'Der', options: ['Der', 'Die'], accepted_answers: ['Der', ' DER '] } }
  expect(await saveGrammarExercise(invalid, id)).toEqual({ success: false, error: 'invalid' })
  expect(createClient).not.toHaveBeenCalled()
})
