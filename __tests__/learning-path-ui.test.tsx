import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import LearningPathClient from '@/components/learning-path/LearningPathClient'
import PathExerciseForm from '@/components/learning-path/PathExerciseForm'
import { getLearningPath, startLearningNode, submitLearningAnswer, startLearningTest, saveLearningTestAnswer, finishLearningTest, getLearningTestReview } from '@/app/actions/learning-path'
import { learningPathMessages, pathErrorText } from '@/lib/learning-path-i18n'
import type { PathExercise, PathMap, PracticeRun, PracticeResult, PathTest, TestResult } from '@/lib/learning-path-contract'

jest.mock('@/app/actions/learning-path', () => ({ getLearningPath: jest.fn(), startLearningNode: jest.fn(), submitLearningAnswer: jest.fn(), startLearningTest: jest.fn(), saveLearningTestAnswer: jest.fn(), finishLearningTest: jest.fn(), getLearningTestReview: jest.fn() }))
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

it('shows the localized empty state for a level without imported paths', () => {
  render(<LearningPathClient initialPath={{ ...map, paths: [] }} level="A1.1" lang="uk" />)
  expect(screen.getByText(learningPathMessages.uk.empty)).toBeVisible()
  expect(screen.queryByTestId('path-answer')).not.toBeInTheDocument()
  expect(startLearningNode).not.toHaveBeenCalled()
})

it('shows a missing-backend error and retries through the same learning-path RPC', async () => {
  render(<LearningPathClient initialError="backend_unavailable" level="A1.1" lang="en" />)
  expect(screen.getByRole('alert')).toHaveTextContent(pathErrorText('en', 'backend_unavailable'))
  fireEvent.click(screen.getByRole('button', { name: learningPathMessages.en.retry }))
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  expect(getLearningPath).toHaveBeenCalledWith('A1.1', 'en')
  expect(screen.getByTestId(`path-node-${id}`)).toBeInTheDocument()
})

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
  expect(screen.getByTestId('path-feedback')).toHaveTextContent('Stars: 3 out of 3')
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

it('restores newer saved test answers after a stale device conflicts', async () => {
  const first: PathTest = { attempt_id: id, node_id: id, total: 2, exercises: [
    { ...run.exercises[0], answer: null }, { id: nextId, type: 'fill_in_blank', answer: null, content: { text_before: 'Du', text_after: 'da.' } },
  ] }
  jest.mocked(startLearningTest).mockResolvedValueOnce({ data: first }).mockResolvedValueOnce({ data: {
    ...first, exercises: first.exercises.map(item => item.id === id ? { ...item, answer: { text: 'saved on iPhone' } } : item),
  } })
  jest.mocked(saveLearningTestAnswer).mockResolvedValueOnce({ error: 'request_conflict' })
  render(<LearningPathClient initialPath={{ ...map, paths: [{ ...map.paths[0], nodes: [{ ...node, kind: 'test' }] }] }} level="A1.1" lang="en" />)
  fireEvent.click(screen.getByTestId(`path-node-${id}`))
  fireEvent.change(await screen.findByTestId('path-answer'), { target: { value: 'stale iPad answer' } })
  fireEvent.click(screen.getByTestId('path-check'))
  await screen.findByRole('alert')
  expect(startLearningTest).toHaveBeenCalledTimes(2)
  expect(screen.getByTestId('path-exercise')).toHaveAttribute('data-exercise-id', nextId)
  expect(screen.getByText('1 of 2 exercises completed')).toBeInTheDocument()
})

it('opens the map first and restores the server queue only after explicit continuation', async () => {
  jest.mocked(startLearningNode).mockResolvedValueOnce({ data: { ...run, total: 2, queue: [nextId],
    exercises: [{ ...run.exercises[0], id: nextId }] } })
  render(<LearningPathClient initialPath={{ ...map, resume_node_id: id, paths: [{ ...map.paths[0], nodes: [{ ...node, status: 'in_progress' }] }] }} level="A1.1" lang="en" />)
  expect(screen.getByTestId('path-map')).toBeInTheDocument()
  expect(startLearningNode).not.toHaveBeenCalled()
  expect(screen.queryByTestId('path-answer')).not.toBeInTheDocument()
  fireEvent.click(within(screen.getByTestId('path-level-progress')).getByRole('button', { name: 'Continue learning' }))
  expect(await screen.findByTestId('path-answer')).toBeInTheDocument()
  expect(startLearningNode).toHaveBeenCalledWith(id, 'en')
  expect(screen.queryByTestId('path-rule-card')).not.toBeInTheDocument()
  expect(screen.getByTestId('path-exercise')).toHaveAttribute('data-exercise-id', nextId)
  expect(screen.getByText('1 of 2 exercises completed')).toBeInTheDocument()
})

it('the hero resumes the latest saved lesson instead of an earlier unstarted one', async () => {
  jest.mocked(startLearningNode).mockResolvedValueOnce({ data: { ...run, node_id: nextId, queue: [nextId],
    exercises: [{ ...run.exercises[0], id: nextId }] } })
  render(<LearningPathClient initialPath={{ ...map, resume_node_id: nextId,
    paths: [{ ...map.paths[0], nodes: [node, { ...node, id: nextId, status: 'in_progress', sort_order: 2 }] }] }} level="A1.1" lang="en" />)
  const hero = screen.getByTestId('path-level-progress')
  expect(within(hero).getAllByRole('button')).toHaveLength(1)
  expect(startLearningNode).not.toHaveBeenCalled()
  fireEvent.click(within(hero).getByRole('button', { name: 'Continue learning' }))
  await screen.findByTestId('path-answer')
  expect(startLearningNode).toHaveBeenCalledWith(nextId, 'en')
  expect(screen.queryByTestId('path-rule-card')).not.toBeInTheDocument()
})

it('the hero continues an active test with earlier results without an extra retry choice', async () => {
  jest.mocked(startLearningTest).mockResolvedValueOnce({ data: { attempt_id: nextId, node_id: nextId, total: 2,
    exercises: [{ ...run.exercises[0], answer: { text: 'saved answer' } }, { ...run.exercises[0], id: nextId, answer: null }] } })
  render(<LearningPathClient initialPath={{ ...map, resume_node_id: nextId,
    paths: [{ ...map.paths[0], nodes: [node, { ...node, id: nextId, kind: 'test', tests: [
      { id, status: 'completed', percentage: 50, passed: false },
      { id: nextId, status: 'active', percentage: null, passed: null },
    ] }] }] }} level="A1.1" lang="en" />)
  fireEvent.click(within(screen.getByTestId('path-level-progress')).getByRole('button', { name: 'Continue learning' }))
  await screen.findByTestId('path-answer')
  expect(startLearningTest).toHaveBeenCalledWith(nextId, 'en')
  expect(screen.queryByTestId('path-test-choice')).not.toBeInTheDocument()
  expect(screen.getByTestId('path-exercise')).toHaveAttribute('data-exercise-id', nextId)
  expect(screen.getByText('1 of 2 exercises completed')).toBeInTheDocument()
})

describe('always-open section tests', () => {
  const testId = '00000000-0000-4000-8000-000000000004'
  const lockedPath: PathMap = { ...map, paths: [{ ...map.paths[0], available: false, nodes: [
    { ...node, available: false }, { ...node, id: nextId, title: 'Next step', sort_order: 2, available: false },
    { ...node, id: testId, kind: 'test', title: 'Section test', sort_order: 3, available: true },
  ] }] }
  const pathTest: PathTest = { attempt_id: id, node_id: testId, total: 1, exercises: [{ ...run.exercises[0], answer: { text: 'saved' } }] }

  async function finishWith(outcome: Partial<TestResult>) {
    jest.mocked(startLearningTest).mockResolvedValue({ data: pathTest })
    jest.mocked(finishLearningTest).mockResolvedValue({ data: { attempt_id: id, percentage: 100, passed: true, recommended_nodes: [], answers: [], ...outcome } })
    render(<LearningPathClient initialPath={lockedPath} level="A1.1" lang="en" />)
    fireEvent.click(screen.getByTestId(`path-node-${testId}`))
    fireEvent.click(await screen.findByTestId('path-test-finish'))
    return screen.findByTestId('path-test-outcome')
  }

  it('keeps the test open inside a locked path while its lessons stay locked', () => {
    render(<LearningPathClient initialPath={lockedPath} level="A1.1" lang="en" />)
    expect(screen.getByTestId(`path-node-${id}`)).toBeDisabled()
    expect(screen.getByTestId(`path-node-${testId}`)).toBeEnabled()
    expect(screen.getByTestId(`path-node-${testId}`)).toHaveTextContent('At least 80% correct answers')
    expect(screen.getByRole('img', { name: 'Not yet available' })).toBeInTheDocument()
  })

  it('celebrates a pass and lists the lessons it unlocked', async () => {
    const outcome = await finishWith({ percentage: 86.67, passed: true })
    expect(outcome).toHaveAttribute('data-passed', 'true')
    expect(outcome).toHaveTextContent('Test passed')
    expect(screen.getByRole('list', { name: 'Unlocked' })).toHaveTextContent('Greetings')
    expect(screen.getByText('Result: 86%')).toBeInTheDocument()
  })

  it('encourages below 80% instead of failing the learner and points to helpful lessons', async () => {
    const outcome = await finishWith({ percentage: 73.33, passed: false, recommended_nodes: [nextId] })
    expect(outcome).toHaveAttribute('data-passed', 'false')
    expect(outcome).toHaveTextContent('Good try!')
    expect(outcome).toHaveTextContent('You are not quite ready yet. Work through the learning path step by step to master the test!')
    expect(outcome).toHaveTextContent('Next step')
    expect(outcome).not.toHaveTextContent('Test passed')
  })
})

it.each(['de', 'en', 'ru', 'uk', 'tr'] as const)('has every interface and error message in %s', lang => {
  expect(Object.keys(learningPathMessages[lang]).sort()).toEqual(Object.keys(learningPathMessages.de).sort())
  expect(Object.values(learningPathMessages[lang]).every(Boolean)).toBe(true)
  expect(pathErrorText(lang, 'node_locked')).toBe(learningPathMessages[lang].error_locked)
  expect(pathErrorText(lang, 'unknown_error')).toBe(learningPathMessages[lang].error)
})

describe('help with the German task (Phase 8)', () => {
  const choice: PathExercise = { id, type: 'multiple_choice', content: { instruction: 'Что вы скажете?', question: 'Es ist sieben Uhr am Morgen.', options: ['Guten Morgen!', 'Gute Nacht!'] },
    translation: { task: 'Семь часов утра.' } }

  it('translates the task only on request and keeps the answer options German', () => {
    const toggle = jest.fn()
    const { rerender } = render(<PathExerciseForm exercise={choice} lang="ru" busy={false} isTest={false} onSubmit={jest.fn()} translationOpen={false} onTranslationToggle={toggle} />)
    const button = screen.getByTestId('path-translate')
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveTextContent('Перевод')
    expect(screen.queryByTestId('path-translation')).not.toBeInTheDocument()
    fireEvent.click(button)
    expect(toggle).toHaveBeenCalledTimes(1)
    rerender(<PathExerciseForm exercise={choice} lang="ru" busy={false} isTest={false} onSubmit={jest.fn()} translationOpen onTranslationToggle={toggle} />)
    expect(screen.getByTestId('path-translation')).toHaveTextContent('Семь часов утра.')
    expect(screen.getByTestId('path-translation').querySelector('p')).toHaveAttribute('lang', 'ru')
    expect(screen.getByText('Es ist sieben Uhr am Morgen.')).toHaveAttribute('lang', 'de')
    for (const option of ['Guten Morgen!', 'Gute Nacht!']) expect(screen.getByText(option)).toHaveAttribute('lang', 'de')
  })

  it('offers no translation button when there is nothing to translate', () => {
    render(<PathExerciseForm exercise={{ ...choice, translation: undefined }} lang="ru" busy={false} isTest={false} onSubmit={jest.fn()} onTranslationToggle={jest.fn()} />)
    expect(screen.queryByTestId('path-translate')).not.toBeInTheDocument()
  })

  it('shows the infinitive in the gap and mirrors the typed answer there', () => {
    const gap: PathExercise = { id, type: 'fill_in_blank', content: { text_before: 'Hallo, ich ', text_after: ' Lara.', gap_hint: 'heißen' } }
    render(<PathExerciseForm exercise={gap} lang="en" busy={false} isTest={false} onSubmit={jest.fn()} />)
    const hint = screen.getByTestId('path-gap-hint')
    expect(hint).toHaveAttribute('data-kind', 'base')
    expect(hint).toHaveAttribute('lang', 'de')
    expect(hint).toHaveTextContent('(Base form: heißen)')
    fireEvent.change(screen.getByTestId('path-answer'), { target: { value: 'heiße' } })
    expect(screen.getByText('heiße', { selector: 'span' })).toBeInTheDocument()
  })

  it('names the meaning in the interface language when the base form would be the answer', () => {
    const gap: PathExercise = { id, type: 'fill_in_blank', content: { text_before: 'Das Sofa steht im ', text_after: '.' }, translation: { gap_hint: 'гостиная' } }
    render(<PathExerciseForm exercise={gap} lang="ru" busy={false} isTest={false} onSubmit={jest.fn()} />)
    const hint = screen.getByTestId('path-gap-hint')
    expect(hint).toHaveAttribute('data-kind', 'meaning')
    expect(hint).toHaveAttribute('lang', 'ru')
    expect(hint).toHaveTextContent('гостиная')
  })

  it('keeps the translation open for the next task in the session', async () => {
    jest.mocked(startLearningNode).mockResolvedValue({ data: { ...run, merkkarte: null, total: 2, queue: [id, nextId],
      exercises: [choice, { ...choice, id: nextId, content: { ...choice.content, question: 'Es ist acht Uhr am Abend.' }, translation: { task: 'Восемь часов вечера.' } }] } })
    jest.mocked(submitLearningAnswer).mockResolvedValue({ data: { ...result, completed: false, stars: null, queue: [nextId] } })
    render(<LearningPathClient initialPath={map} level="A1.1" lang="ru" />)
    fireEvent.click(screen.getByTestId(`path-node-${id}`))
    fireEvent.click(await screen.findByTestId('path-translate'))
    expect(await screen.findByTestId('path-translation')).toHaveTextContent('Семь часов утра.')
    fireEvent.click(screen.getByText('Guten Morgen!'))
    fireEvent.click(screen.getByTestId('path-check'))
    fireEvent.click(await screen.findByTestId('path-next'))
    expect(await screen.findByTestId('path-translation')).toHaveTextContent('Восемь часов вечера.')
    expect(screen.getByTestId('path-translate')).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('test evaluation (Phase 8)', () => {
  const testId = '00000000-0000-4000-8000-000000000004'
  const answers: TestResult['answers'] = [
    { id, type: 'fill_in_blank', content: { instruction: 'Fill the gap.', text_before: 'Ich', text_after: 'hier.', gap_hint: 'wohnen' }, answer: { text: 'wohnt' },
      result: { status: 'INCORRECT', correct: false, fields: [] }, solution: { content: { correct_answer: 'wohne' }, explanation: 'Ich wohne: ending -e.' } },
    { id: nextId, type: 'multiple_choice', content: { question: 'Es ist sieben Uhr.', options: ['Guten Morgen!', 'Gute Nacht!'] }, answer: { index: 0 },
      result: { status: 'EXACT', correct: true, fields: [] }, solution: { content: { correct_answer: 'Guten Morgen!' }, explanation: null } },
  ]
  const done: PathMap = { ...map, paths: [{ ...map.paths[0], nodes: [{ ...node, id: testId, kind: 'test', title: 'Section test',
    tests: [{ id, status: 'completed', percentage: 50, passed: false, completed_at: '2026-09-28T10:00:00Z' }] }] }] }

  it('asks what to do with a completed test and shows own answers next to the solutions', async () => {
    jest.mocked(getLearningTestReview).mockResolvedValue({ data: { attempt_id: id, percentage: 50, passed: false, recommended_nodes: [], answers, completed_at: '2026-09-28T10:00:00Z' } })
    render(<LearningPathClient initialPath={done} level="A1.1" lang="en" />)
    fireEvent.click(screen.getByTestId(`path-node-${testId}`))
    expect(await screen.findByTestId('path-test-choice')).toHaveTextContent('50')
    expect(startLearningTest).not.toHaveBeenCalled()
    expect(screen.getByTestId('path-choice-start')).toHaveTextContent('Start the test again')
    fireEvent.click(screen.getByTestId('path-choice-review'))
    const review = await screen.findByTestId('path-test-review')
    expect(getLearningTestReview).toHaveBeenCalledWith(testId, 'en')
    expect(review).toHaveTextContent('1 of 2 correct')
    const items = screen.getAllByTestId('path-review-item')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent('Your answer')
    expect(items[0]).toHaveTextContent('wohnt')
    expect(items[0]).toHaveTextContent('wohne')
    expect(items[0]).toHaveTextContent('Ich wohne: ending -e.')
    fireEvent.click(screen.getByTestId('path-review-filter-all'))
    expect(screen.getAllByTestId('path-review-item')).toHaveLength(2)
    expect(screen.getAllByTestId('path-review-item')[1]).toHaveTextContent('Guten Morgen!')
  })

  it('starts the test again from the choice or from the evaluation', async () => {
    jest.mocked(startLearningTest).mockResolvedValue({ data: { attempt_id: nextId, node_id: testId, total: 1, exercises: [{ ...run.exercises[0], answer: null }] } })
    render(<LearningPathClient initialPath={done} level="A1.1" lang="en" />)
    fireEvent.click(screen.getByTestId(`path-node-${testId}`))
    fireEvent.click(await screen.findByTestId('path-choice-start'))
    expect(await screen.findByTestId('path-answer')).toBeInTheDocument()
    expect(startLearningTest).toHaveBeenCalledWith(testId, 'en')
  })

  it('opens the evaluation right after finishing a test', async () => {
    const pathTest: PathTest = { attempt_id: id, node_id: testId, total: 1, exercises: [{ ...run.exercises[0], answer: { text: 'wohnt' } }] }
    jest.mocked(startLearningTest).mockResolvedValue({ data: pathTest })
    jest.mocked(finishLearningTest).mockResolvedValue({ data: { attempt_id: id, percentage: 0, passed: false, recommended_nodes: [], answers: [answers[0]] } })
    render(<LearningPathClient initialPath={{ ...map, paths: [{ ...map.paths[0], nodes: [{ ...node, id: testId, kind: 'test' }] }] }} level="A1.1" lang="en" />)
    fireEvent.click(screen.getByTestId(`path-node-${testId}`))
    fireEvent.click(await screen.findByTestId('path-test-finish'))
    fireEvent.click(await screen.findByTestId('path-outcome-review'))
    expect(await screen.findByTestId('path-test-review')).toHaveTextContent('wohnt')
    expect(getLearningTestReview).not.toHaveBeenCalled()
  })
})
