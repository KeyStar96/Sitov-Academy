import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import LearningPathClient from '@/components/learning-path/LearningPathClient'
import PathExerciseForm from '@/components/learning-path/PathExerciseForm'
import { getLearningPath, startLearningNode, submitLearningAnswer, startLearningTest, saveLearningTestAnswer, finishLearningTest } from '@/app/actions/learning-path'
import { learningPathMessages, pathErrorText } from '@/lib/learning-path-i18n'
import type { PathMap, PracticeRun, PracticeResult, PathTest, TestResult } from '@/lib/learning-path-contract'

jest.mock('@/app/actions/learning-path', () => ({ getLearningPath: jest.fn(), startLearningNode: jest.fn(), submitLearningAnswer: jest.fn(), startLearningTest: jest.fn(), saveLearningTestAnswer: jest.fn(), finishLearningTest: jest.fn() }))
jest.unmock('lucide-react')
const id = '00000000-0000-4000-8000-000000000001'
const nextId = '00000000-0000-4000-8000-000000000002'
const node = { id, kind: 'practice' as const, title: 'Greetings', sort_order: 1, available: true, status: null, stars: 0, tests: [] }
const map: PathMap = { level: 'A1.1', completed: false, next_level: 'A1.2', next_level_available: false,
  paths: [{ id, source_id: 'P1', title: 'First path', sort_order: 1, available: true, completed: false,
    nodes: [node, { ...node, id: nextId, title: 'Next step', available: false, sort_order: 2 }] }] }
const run: PracticeRun = { run_id: id, node_id: id, total: 1, queue: [id], merkkarte: { rule: 'German rule explained in English.', examples: ['Guten Tag!'] },
  exercises: [{ id, type: 'fill_in_blank', content: { text_before: 'Ich', text_after: 'hier.', instruction: 'Fill the gap.' } }] }
const result: PracticeResult = { grade: { status: 'EXACT', correct: true, fields: [{ id: 'answer', status: 'EXACT', correct: true, matched: 'wohne', reason: null, hint: 'capitalization' }] },
  solution: { content: { correct_answer: 'wohne' }, explanation: 'A localized explanation.' }, completed: true, stars: 3, first_attempt_accuracy: 100, queue: [] }

beforeEach(() => {
  jest.clearAllMocks()
  Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: jest.fn(() => '00000000-0000-4000-8000-000000000003') })
  jest.mocked(startLearningNode).mockResolvedValue({ data: run })
  jest.mocked(submitLearningAnswer).mockResolvedValue({ data: result })
  jest.mocked(getLearningPath).mockResolvedValue({ data: { ...map, paths: [{ ...map.paths[0], nodes: [{ ...node, status: 'completed', stars: 3 }, { ...map.paths[0].nodes[1], available: true }] }] } })
})

async function openPractice() {
  render(<LearningPathClient initialPath={map} level="A1.1" lang="en" />)
  fireEvent.click(screen.getByTestId(`path-node-${id}`))
  await screen.findByTestId('path-rule-card')
  fireEvent.click(screen.getByTestId('path-rule-continue'))
  await screen.findByTestId('path-answer')
}

it('shows the translated rule card before the first exercise and honours server locks', async () => {
  render(<LearningPathClient initialPath={map} level="A1.1" lang="en" />)
  expect(screen.getByTestId(`path-node-${nextId}`)).toBeDisabled()
  fireEvent.click(screen.getByTestId(`path-node-${id}`))
  expect(await screen.findByTestId('path-rule-card')).toHaveTextContent('German rule explained in English.')
  expect(screen.getByText('Guten Tag!').closest('ul')).toHaveAttribute('lang', 'de')
  expect(screen.queryByTestId('path-exercise')).not.toBeInTheDocument()
  expect(submitLearningAnswer).not.toHaveBeenCalled()
})

it('displays server grades, neutral hints and refreshes unlocking only from the RPC map', async () => {
  await openPractice()
  expect(screen.queryByText('wohne')).not.toBeInTheDocument()
  fireEvent.change(screen.getByTestId('path-answer'), { target: { value: 'WOHNE' } })
  fireEvent.click(screen.getByTestId('path-check'))
  expect(await screen.findByTestId('path-feedback')).toHaveTextContent('Correct! Well done.')
  expect(screen.getByRole('note')).toHaveTextContent('This is how it is written: wohne')
  expect(screen.getByText('Stars: 3 out of 3')).toBeInTheDocument()
  expect(submitLearningAnswer).toHaveBeenCalledWith(expect.objectContaining({ answer: { text: 'WOHNE' }, locale: 'en' }))
  fireEvent.click(screen.getByTestId('path-next'))
  expect(await screen.findByTestId(`path-node-${nextId}`)).toBeEnabled()
})

it('repeats an incorrect task according to the returned queue', async () => {
  jest.mocked(submitLearningAnswer).mockResolvedValue({ data: { ...result, grade: { status: 'INCORRECT', correct: false, fields: [] }, completed: false, stars: null, queue: [id], first_attempt_accuracy: 0 } })
  await openPractice()
  fireEvent.change(screen.getByTestId('path-answer'), { target: { value: 'wohnen' } })
  fireEvent.click(screen.getByTestId('path-check'))
  expect(await screen.findByTestId('path-feedback')).toHaveTextContent('You will see this exercise again.')
  fireEvent.click(screen.getByTestId('path-next'))
  expect(screen.getByTestId('path-answer')).toHaveValue('')
  expect(screen.queryByTestId('path-feedback')).not.toBeInTheDocument()
})

it('retries a lost response with the same idempotency receipt', async () => {
  jest.mocked(submitLearningAnswer).mockResolvedValueOnce({ error: 'request_failed' }).mockResolvedValueOnce({ data: result })
  await openPractice()
  fireEvent.change(screen.getByTestId('path-answer'), { target: { value: 'wohne' } })
  fireEvent.click(screen.getByTestId('path-check'))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByTestId('path-check'))
  await screen.findByTestId('path-feedback')
  const calls = jest.mocked(submitLearningAnswer).mock.calls
  expect(calls).toHaveLength(2)
  expect(calls[1][0].requestId).toBe(calls[0][0].requestId)
})

it('submits a choice index without client grading', () => {
  const submit = jest.fn()
  render(<PathExerciseForm exercise={{ id, type: 'multiple_choice', content: { question: 'Hallo?', options: ['Guten Tag', 'Tschüss'] } }} lang="en" busy={false} isTest={false} onSubmit={submit} />)
  expect(screen.getByTestId('path-check')).toBeDisabled()
  fireEvent.click(screen.getByRole('radio', { name: 'Tschüss' }))
  fireEvent.click(screen.getByTestId('path-check'))
  expect(submit).toHaveBeenCalledWith({ index: 1 })
  expect(screen.queryByText('Correct! Well done.')).not.toBeInTheDocument()
})

it('builds sentences with keyboard-operable buttons and preserves repeated word indices', () => {
  const submit = jest.fn()
  render(<PathExerciseForm exercise={{ id, type: 'sentence_building', content: { parts: ['ist', 'Das', 'das.'] } }} lang="en" busy={false} isTest={false} onSubmit={submit} />)
  fireEvent.click(screen.getByRole('button', { name: 'Add word: Das' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add word: ist' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add word: das.' }))
  fireEvent.click(screen.getByRole('button', { name: 'Remove word: ist' }))
  expect(screen.getByTestId('path-check')).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Add word: ist' }))
  fireEvent.click(screen.getByTestId('path-check'))
  expect(submit).toHaveBeenCalledWith({ indices: [1, 2, 0] })
})

it('resumes unanswered test items, saves without grading and shows server final results', async () => {
  const pathTest: PathTest = { attempt_id: id, node_id: id, total: 2, exercises: [{ ...run.exercises[0], id: nextId, answer: { text: 'saved' } }, { ...run.exercises[0], answer: null }] }
  const finished: TestResult = { attempt_id: id, percentage: 100, passed: true, recommended_nodes: [], answers: [{ ...run.exercises[0], answer: { text: 'wohne' }, result: result.grade, solution: result.solution }] }
  jest.mocked(startLearningTest).mockResolvedValue({ data: pathTest })
  jest.mocked(saveLearningTestAnswer).mockResolvedValue({ data: { saved: true } })
  jest.mocked(finishLearningTest).mockResolvedValue({ data: finished })
  render(<LearningPathClient initialPath={{ ...map, paths: [{ ...map.paths[0], nodes: [{ ...node, kind: 'test' }] }] }} level="A1.1" lang="en" />)
  fireEvent.click(screen.getByTestId(`path-node-${id}`))
  fireEvent.change(await screen.findByTestId('path-answer'), { target: { value: 'wohne' } })
  expect(screen.getByText('1 of 2 exercises completed')).toBeInTheDocument()
  fireEvent.click(screen.getByTestId('path-check'))
  await screen.findByTestId('path-test-finish')
  expect(screen.queryByTestId('path-feedback')).not.toBeInTheDocument()
  fireEvent.click(screen.getByTestId('path-test-finish'))
  await waitFor(() => expect(screen.getByText('Test passed')).toBeInTheDocument())
  expect(finishLearningTest).toHaveBeenCalledWith(id, 'en')
})

it.each(['de', 'en', 'ru', 'uk', 'tr'] as const)('has every interface and error message in %s', lang => {
  expect(Object.keys(learningPathMessages[lang]).sort()).toEqual(Object.keys(learningPathMessages.de).sort())
  expect(Object.values(learningPathMessages[lang]).every(Boolean)).toBe(true)
  expect(pathErrorText(lang, 'node_locked')).toBe(learningPathMessages[lang].error_locked)
  expect(pathErrorText(lang, 'unknown_error')).toBe(learningPathMessages[lang].error)
})
