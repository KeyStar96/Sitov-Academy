import { recordExerciseAttempt } from '@/app/actions/exercises'
import { createClient } from '@/utils/supabase/server'

jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/access/server', () => ({ loadLevelAccessProfile: jest.fn() }))
jest.mock('server-only', () => ({}), { virtual: true })

const input = { exerciseId: '00000000-0000-4000-8000-000000000001', answer: 'Guten Morgn.', hintShown: false }
const grade = { success: true, attempts: 1, isCorrect: true, status: 'SOFT_ERROR', matched: 'Guten Morgen.', reason: 'typo', score: 90 }

function setup(data: unknown, error: unknown = null) {
  const rpc = jest.fn().mockResolvedValue({ data, error })
  jest.mocked(createClient).mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'student' } } }) }, rpc,
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  return rpc
}

beforeEach(() => jest.clearAllMocks())

it('preserves the server soft-error grade and score', async () => {
  const rpc = setup(grade)
  expect(await recordExerciseAttempt(input)).toEqual(grade)
  expect(rpc).toHaveBeenCalledWith('record_grammar_attempt', {
    p_exercise_id: input.exerciseId, p_answer: input.answer, p_hint_shown: false,
  })
})

it.each([
  { ...grade, status: 'UNKNOWN' },
  { ...grade, reason: 'unknown' },
  { ...grade, reason: null },
  { ...grade, isCorrect: false },
  { ...grade, score: 100 },
  { success: true, attempts: 1, isCorrect: true },
  { ...grade, status: 'INCORRECT', isCorrect: false, matched: 'Guten Morgen.', reason: null },
])('fails closed for an invalid server contract: %j', async data => {
  setup(data)
  expect(await recordExerciseAttempt(input)).toEqual({ success: false, attempts: 0 })
})

it('does not treat a structured RPC error as a solved answer', async () => {
  setup({ error: 'grade_failed', message: 'Could not grade answer' })
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try { expect(await recordExerciseAttempt(input)).toEqual({ success: false, attempts: 0 }) }
  finally { log.mockRestore() }
})
