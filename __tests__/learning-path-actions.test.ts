import { getLearningPath, startLearningNode, submitLearningAnswer, startLearningTest, saveLearningTestAnswer, finishLearningTest } from '@/app/actions/learning-path'
import { createClient } from '@/utils/supabase/server'

jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
const id = '00000000-0000-4000-8000-000000000001'
const runId = '00000000-0000-4000-8000-000000000002'
const requestId = '00000000-0000-4000-8000-000000000003'
const exercise = { id, type: 'fill_in_blank', content: { text_before: 'Ich', text_after: 'hier.', instruction: 'Fill the gap.' } }
const run = { run_id: runId, node_id: id, queue: [id], total: 1, exercises: [exercise], merkkarte: null }
const grade = { status: 'EXACT', correct: true, fields: [{ id: 'answer', status: 'EXACT', correct: true, matched: 'wohne', reason: null, hint: 'capitalization' }] }
const graded = { grade, solution: { content: { correct_answer: 'wohne' }, explanation: 'Explanation' }, completed: true, stars: 3, first_attempt_accuracy: 100, queue: [] }
function setup(data: unknown, error: unknown = null, user: unknown = { id: 'student' }) {
  const rpc = jest.fn().mockResolvedValue({ data, error })
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) }, rpc } as unknown as Awaited<ReturnType<typeof createClient>>)
  return rpc
}
beforeEach(() => jest.clearAllMocks())

it('uses the authenticated RPC and strips solutions even if a backend accidentally returns them', async () => {
  const rpc = setup({ ...run, exercises: [{ ...exercise, solution: 'secret', content: { ...exercise.content, correct_answer: 'secret', accepted_answers: ['secret'], target_form: ['secret'] } }] })
  expect(await startLearningNode(id, 'en')).toEqual({ data: run })
  expect(rpc).toHaveBeenCalledWith('start_path_node', { p_node_id: id, p_locale: 'en', p_restart: false })
})

it('preserves database grading and neutral orthography hints', async () => {
  const rpc = setup(graded)
  expect(await submitLearningAnswer({ runId, exerciseId: id, requestId, answer: { text: 'WOHNE' }, locale: 'en' })).toEqual({ data: graded })
  expect(rpc).toHaveBeenCalledWith('submit_path_answer', { p_run_id: runId, p_exercise_id: id, p_request_id: requestId, p_answer: { text: 'WOHNE' }, p_locale: 'en' })
})

it('refuses contradictory or malformed grading instead of inferring correctness', async () => {
  setup({ ...graded, grade: { ...grade, correct: false } })
  expect(await submitLearningAnswer({ runId, exerciseId: id, requestId, answer: { text: 'wohne' }, locale: 'en' })).toEqual({ error: 'invalid_response' })
})

it('does not call an RPC without an authenticated session', async () => {
  const rpc = setup(run, null, null)
  expect(await startLearningNode(id, 'ru')).toEqual({ error: 'authentication_required' })
  expect(rpc).not.toHaveBeenCalled()
})

it.each(['node_locked', 'learning_reset_in_progress', 'answer_out_of_order'])('preserves structured %s errors without requiring a message field', async error => {
  setup({ error, sqlstate: '42501' })
  expect(await startLearningNode(id, 'tr')).toEqual({ error })
})

it('only uses missing-function failures for compatibility fallback', async () => {
  setup(null, { code: 'PGRST202' })
  expect(await getLearningPath('A1.1', 'uk')).toEqual({ error: 'backend_unavailable' })
  setup(null, { code: '42501' })
  expect(await getLearningPath('A1.1', 'uk')).toEqual({ error: 'request_failed' })
})

it('rejects invalid IDs, locales, levels and authoring fields before the RPC', async () => {
  const rpc = setup(run)
  expect(await startLearningNode('invalid', 'en')).toEqual({ error: 'invalid_input' })
  expect(await getLearningPath('A1.1', 'unknown')).toEqual({ error: 'invalid_input' })
  expect(await getLearningPath('anything', 'en')).toEqual({ error: 'invalid_input' })
  expect(await submitLearningAnswer({ runId, exerciseId: id, requestId, answer: { text: 'wohne', correct: true }, locale: 'en' })).toEqual({ error: 'invalid_input' })
  expect(rpc).not.toHaveBeenCalled()
})

it('does not expose solutions or grades from test start/save responses', async () => {
  const test = { attempt_id: runId, node_id: id, total: 1, exercises: [{ ...exercise, answer: null }] }
  setup({ ...test, exercises: [{ ...exercise, answer: null, result: grade, solution: graded.solution }] })
  expect(await startLearningTest(id, 'en')).toEqual({ data: test })
  const rpc = setup({ saved: true, result: grade, solution: graded.solution })
  expect(await saveLearningTestAnswer({ attemptId: runId, exerciseId: id, answer: { text: 'wohne' } })).toEqual({ data: { saved: true } })
  expect(rpc).toHaveBeenCalledWith('submit_path_test_answer', { p_attempt_id: runId, p_exercise_id: id, p_answer: { text: 'wohne' } })
})

it('returns test results only from the finishing RPC', async () => {
  const result = { attempt_id: runId, percentage: 100, passed: true, recommended_nodes: [], answers: [{ ...exercise, answer: { text: 'wohne' }, result: grade, solution: graded.solution }] }
  const rpc = setup(result)
  expect(await finishLearningTest(runId, 'en')).toEqual({ data: result })
  expect(rpc).toHaveBeenCalledWith('finish_path_test', { p_attempt_id: runId, p_locale: 'en' })
})

it('displays a finished test when PostgreSQL marks an ungradable saved answer incorrect', async () => {
  const incorrect = { status: 'INCORRECT', correct: false }
  const result = { attempt_id: runId, percentage: 0, passed: false, recommended_nodes: [id],
    answers: [{ ...exercise, answer: { index: 127 }, result: incorrect, solution: graded.solution }] }
  setup(result)
  expect(await finishLearningTest(runId, 'en')).toEqual({ data: { ...result,
    answers: [{ ...result.answers[0], result: { ...incorrect, fields: [] } }] } })
})

it.each(['EXACT', 'SOFT_ERROR'])('rejects a %s test grade that omits its fields', async status => {
  setup({ attempt_id: runId, percentage: 100, passed: true, recommended_nodes: [],
    answers: [{ ...exercise, answer: { text: 'wohne' }, result: { status, correct: true }, solution: graded.solution }] })
  expect(await finishLearningTest(runId, 'en')).toEqual({ error: 'invalid_response' })
})
