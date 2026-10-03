import { recordExerciseAttempt, recordGrammarCheckpointAttempt } from '@/app/actions/exercises'
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

it('rejects an attempt from a stale browser after the signed-in account changes', async () => {
  const rpc = setup(grade)
  expect(await recordExerciseAttempt(input, 'previous-student')).toEqual({ success: false, attempts: 0 })
  expect(rpc).not.toHaveBeenCalled()
})

const context = { level: 'A1.1', expectedRevision: 1, requestId: '00000000-0000-4000-8000-000000000010', expectedLearnerId: 'student' }
const checkpoint = { state: { exerciseIds: [input.exerciseId], currentIndex: 1 }, revision: 2, updatedAt: '2026-10-03T10:00:00Z' }

it('returns the grade and account cursor saved by one authenticated transaction', async () => {
  const rpc = setup({ grade, checkpoint })
  expect(await recordGrammarCheckpointAttempt(input, context)).toEqual({ ok: true, grade, checkpoint, learnerId: 'student' })
  expect(rpc).toHaveBeenCalledWith('sitov_record_grammar_checkpoint_attempt', {
    p_exercise_id: input.exerciseId, p_answer: input.answer, p_hint_shown: false, p_level: 'A1.1', p_expected_revision: 1, p_request_id: context.requestId,
  })
})

it('preserves a bare SQL conflict and its authoritative checkpoint for a stale device', async () => {
  setup({ error: 'conflict', checkpoint })
  expect(await recordGrammarCheckpointAttempt(input, context)).toEqual({ ok: false, error: 'conflict', checkpoint })
})

it('never grades a stale account session against the replacement account', async () => {
  const rpc = setup({ grade, checkpoint })
  expect(await recordGrammarCheckpointAttempt(input, { ...context, expectedLearnerId: 'old-student' })).toEqual({ ok: false, error: 'unauthorized' })
  expect(rpc).not.toHaveBeenCalled()
})

it('rejects an invalid atomic grade instead of advancing the session', async () => {
  setup({ grade: { ...grade, score: 100 }, checkpoint })
  expect(await recordGrammarCheckpointAttempt(input, context)).toEqual({ ok: false, error: 'unavailable' })
})
