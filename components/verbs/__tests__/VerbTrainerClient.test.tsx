import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import VerbTrainerClient, { type SitovVerbTrainerActions } from '../VerbTrainerClient'
import type { SitovVerbTrainerState, SitovVerbPublicExercise, SitovVerbReviewResult } from '@/lib/verbs/contracts'

jest.mock('@/app/actions/verbs', () => ({ nextSitovVerbExercise: jest.fn(), setSitovVerbBox: jest.fn(), submitSitovVerbAnswer: jest.fn() }))
jest.unmock('lucide-react')

const sitovState: SitovVerbTrainerState = {
  learnerId: 'sitov-test', level: 'A1.2', authorizedLevels: ['A1.1', 'A1.2'], tenses: ['present', 'perfect'],
  selectedIds: ['sitov-fahren'], progress: [], verbs: [{ id: 'sitov-fahren', unitId: 'sitov-unit', infinitive: 'fahren', level: 'A1.1',
    translations: { de: 'fahren', en: 'travel by vehicle', ru: 'ехать', uk: 'їхати', tr: 'araçla gitmek' },
    present: ['fahre', 'fährst', 'fährt', 'fahren', 'fahrt', 'fahren'], past: ['fuhr', 'fuhrst', 'fuhr', 'fuhren', 'fuhrt', 'fuhren'],
    presentParts: [['fahre', ''], ['fährst', ''], ['fährt', ''], ['fahren', ''], ['fahrt', ''], ['fahren', '']],
    pastParts: [['fuhr', ''], ['fuhrst', ''], ['fuhr', ''], ['fuhren', ''], ['fuhrt', ''], ['fuhren', '']],
    participles: ['gefahren'], auxiliaries: ['sein'] }],
}
const sitovExercise: SitovVerbPublicExercise = { exerciseId: '2e45a8a0-bca2-409e-a05f-4b47a5b5c1b3', verbId: 'sitov-fahren',
  infinitive: 'fahren', translation: 'travel by vehicle', tense: 'present', kind: 'conjugation', prompt: 'Ergänze die Form.', parts: ['du ', ''], person: 1 }
const sitovReview: SitovVerbReviewResult = { correct: true, solution: 'fährst', progress: { verbId: 'sitov-fahren', tense: 'present', box: 2,
  attempts: 1, correct: 1, lapses: 0, nextReviewAt: '2099-01-01T00:00:00Z', lastAnsweredAt: '2026-10-03T10:00:00Z' } }
function sitovActions(): SitovVerbTrainerActions {
  return { next: jest.fn().mockResolvedValue({ data: sitovExercise }), box: jest.fn().mockResolvedValue({ data: { selectedIds: ['sitov-fahren'] } }), answer: jest.fn().mockResolvedValue({ data: sitovReview }) }
}

test('passes the interface language, shows its short meaning, and saves the actual answer once', async () => {
  const actions = sitovActions()
  render(<VerbTrainerClient initialState={sitovState} lang="en" actions={actions} />)
  fireEvent.click(screen.getByRole('button', { name: 'Start practising' }))
  await screen.findByText('travel by vehicle')
  expect(actions.next).toHaveBeenCalledWith(expect.objectContaining({ level: 'A1.2' }), 'en')
  fireEvent.change(screen.getByRole('textbox', { name: 'Your answer 1' }), { target: { value: 'fährst' } })
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
  await screen.findByText('Got it!')
  expect(actions.answer).toHaveBeenCalledTimes(1)
  expect(actions.answer).toHaveBeenCalledWith({ exerciseId: sitovExercise.exerciseId, answer: ['fährst'] })
  expect(screen.getByRole('button', { name: 'Next form' })).toHaveFocus()
})

test('revealing records a blank attempt, and shows the server solution', async () => {
  const actions = sitovActions()
  actions.answer = jest.fn().mockResolvedValue({ data: { ...sitovReview, correct: false } })
  render(<VerbTrainerClient initialState={sitovState} lang="en" actions={actions} />)
  fireEvent.click(screen.getByRole('button', { name: 'Start practising' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Show solution' }))
  await screen.findByText('We will practise this form again.')
  expect(actions.answer).toHaveBeenCalledWith({ exerciseId: sitovExercise.exerciseId, answer: [''] })
  expect(screen.getByText('fährst')).toBeInTheDocument()
})

test('a failed box mutation keeps the confirmed selection and displays an error', async () => {
  const actions = sitovActions()
  actions.box = jest.fn().mockResolvedValue({ error: 'not_authorized' })
  render(<VerbTrainerClient initialState={sitovState} lang="en" actions={actions} />)
  fireEvent.click(screen.getByRole('button', { name: 'My verb box' }))
  fireEvent.click(screen.getByRole('button', { name: 'Remove: fahren' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Your access has changed')
  expect(screen.getByRole('button', { name: 'Remove: fahren' })).toHaveAttribute('aria-pressed', 'true')
})

test('a pending answer cannot be submitted a second time, and failure permits retry', async () => {
  let settle!: (value: { error: string }) => void
  const actions = sitovActions()
  actions.answer = jest.fn().mockImplementation(() => new Promise(resolve => { settle = resolve }))
  render(<VerbTrainerClient initialState={sitovState} lang="en" actions={actions} />)
  fireEvent.click(screen.getByRole('button', { name: 'Start practising' }))
  const input = await screen.findByRole('textbox', { name: 'Your answer 1' })
  fireEvent.change(input, { target: { value: 'fährst' } })
  const button = screen.getByRole('button', { name: 'Check answer' })
  fireEvent.click(button); fireEvent.click(button)
  expect(actions.answer).toHaveBeenCalledTimes(1)
  settle({ error: 'request_failed' })
  await screen.findByRole('alert')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Check answer' })).toBeEnabled())
  expect(input).toHaveValue('fährst')
})

test('focused practice never starts with no selected tense and future levels remain locked', () => {
  render(<VerbTrainerClient initialState={sitovState} lang="en" actions={sitovActions()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Focused practice' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Present' })); fireEvent.click(screen.getByRole('checkbox', { name: 'Perfect' }))
  expect(screen.getByRole('button', { name: 'Start a focused round' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'My verb box' }))
  expect(screen.getByRole('button', { name: 'B1.1' })).toBeDisabled()
})
