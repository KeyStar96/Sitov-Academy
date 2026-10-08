import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import VerbTrainerClient, { type SitovVerbTrainerActions } from '../VerbTrainerClient'
import type { SitovVerbTrainerState, SitovVerbPublicExercise, SitovVerbReviewResult } from '@/lib/verbs/contracts'
import { sitovTrainerUiCopy } from '@/lib/sitov-trainer-ui-i18n'
import { getSitovVerbCopy } from '@/lib/verbs/i18n'

jest.mock('@/app/actions/verbs', () => ({ nextSitovVerbExercise: jest.fn(), setSitovVerbBox: jest.fn(), submitSitovVerbAnswer: jest.fn(), checkSitovVerbRetry: jest.fn() }))
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
  return { next: jest.fn().mockResolvedValue({ data: sitovExercise }), box: jest.fn().mockResolvedValue({ data: { selectedIds: ['sitov-fahren'] } }), answer: jest.fn().mockResolvedValue({ data: sitovReview }), retry: jest.fn().mockResolvedValue({ data: { ...sitovReview, retry: true } }) }
}

function sitovHeroButton(label: string = sitovTrainerUiCopy('en').practice, title: string = getSitovVerbCopy('en').title) {
  return within(screen.getByRole('region', { name: title })).getByRole('button', { name: label })
}

test('overview puts its shared navigation before one launch widget, the learning box and profile settings', () => {
  render(<VerbTrainerClient initialState={sitovState} lang="en" actions={sitovActions()} />)
  const navigation = screen.getByRole('navigation', { name: 'Your verb trainer' })
  expect(within(navigation).getAllByRole('button').map(button => button.textContent)).toEqual(['My practice', 'My verb box', 'Focused practice'])
  const hero = screen.getByRole('region', { name: 'Make verb forms your own.' })
  const box = screen.getByRole('region', { name: 'Your verb learning box' })
  const settings = screen.getByRole('link', { name: 'Trainer settings' })
  expect(navigation.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(hero.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(box.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getAllByRole('button', { name: sitovTrainerUiCopy('en').practice })).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Start practising' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Choose verbs' })).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox', { name: 'Present' })).not.toBeInTheDocument()
  expect(settings).toHaveAttribute('href', '/en/dashboard/profile#trainers')
  expect(within(box).getByText('How the learning box works')).toBeInTheDocument()
})

test('verb selection replaces the overview and preserves a clear route back to practice', () => {
  render(<VerbTrainerClient initialState={sitovState} lang="en" actions={sitovActions()} />)
  fireEvent.click(screen.getByRole('button', { name: 'My verb box' }))
  expect(screen.queryByRole('region', { name: 'Make verb forms your own.' })).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Your verb learning box' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Remove: fahren' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'My verb box' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'My practice' }))
  expect(sitovHeroButton()).toBeEnabled()
  expect(screen.getByRole('region', { name: 'Your verb learning box' })).toBeInTheDocument()
})

test('focused practice puts tense choices and its single start action together and sends only selected tenses', async () => {
  const actions = sitovActions()
  render(<VerbTrainerClient initialState={sitovState} lang="en" actions={actions} />)
  fireEvent.click(screen.getByRole('button', { name: 'Focused practice' }))
  const hero = screen.getByRole('region', { name: 'Today, follow your focus.' })
  fireEvent.click(within(hero).getByRole('checkbox', { name: 'Present' }))
  expect(within(hero).getByRole('checkbox', { name: 'Perfect' })).toBeChecked()
  expect(screen.getAllByRole('button', { name: 'Start a focused round' })).toHaveLength(1)
  fireEvent.click(within(hero).getByRole('button', { name: 'Start a focused round' }))
  expect(await screen.findByRole('textbox', { name: 'Your answer 1' })).toHaveFocus()
  expect(actions.next).toHaveBeenCalledWith({ level: 'A1.2', tenses: ['perfect'], excludeVerbId: undefined }, 'en')
  expect(screen.queryByRole('navigation', { name: 'Your verb trainer' })).not.toBeInTheDocument()
})

test('an empty focused selection cannot start, while automatic practice restores all available tenses', async () => {
  const actions = sitovActions()
  render(<VerbTrainerClient initialState={sitovState} lang="en" actions={actions} />)
  fireEvent.click(screen.getByRole('button', { name: 'Focused practice' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Present' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Perfect' }))
  const focused = sitovHeroButton('Start a focused round', 'Today, follow your focus.')
  expect(focused).toBeDisabled()
  fireEvent.click(focused)
  expect(actions.next).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'My practice' }))
  fireEvent.click(sitovHeroButton())
  expect(await screen.findByRole('textbox', { name: 'Your answer 1' })).toHaveFocus()
  expect(actions.next).toHaveBeenCalledTimes(1)
  expect(actions.next).toHaveBeenCalledWith({ level: 'A1.2', tenses: ['present', 'perfect'], excludeVerbId: undefined }, 'en')
  expect(screen.queryByRole('region', { name: 'Practice overview' })).not.toBeInTheDocument()
})

test('the hero guides an empty verb box to its selection without starting an invalid round', () => {
  const actions = sitovActions()
  render(<VerbTrainerClient initialState={{ ...sitovState, selectedIds: [] }} lang="en" actions={actions} />)
  fireEvent.click(sitovHeroButton('Choose verbs'))
  expect(screen.getByRole('button', { name: 'Add: fahren' })).toBeInTheDocument()
  expect(actions.next).not.toHaveBeenCalled()
})

test('passes the interface language, shows its short meaning, and saves the actual answer once', async () => {
  const actions = sitovActions()
  render(<VerbTrainerClient initialState={sitovState} lang="en" actions={actions} />)
  fireEvent.click(sitovHeroButton())
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
  fireEvent.click(sitovHeroButton())
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
  fireEvent.click(sitovHeroButton())
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

test('the independent box shows a verb once and its exact separate tense progress', async () => {
  const source = { ...sitovState, progress: [{ ...sitovReview.progress, box: 6, attempts: 6, correct: 6 }] }
  render(<VerbTrainerClient initialState={source} lang="en" actions={sitovActions()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Open Box 1 · New' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('fahren')).toHaveAttribute('translate', 'no')
  expect(within(dialog).getByText('Box 6 · Confident')).toBeInTheDocument()
  expect(within(dialog).getByText('Box 1 · New', { selector: 'span' })).toBeInTheDocument()
  expect(within(dialog).getByText('Some tenses are already further along')).toBeInTheDocument()
  expect(within(dialog).getByText('Not practised yet')).toBeInTheDocument()
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Search this box for a verb or meaning' }), { target: { value: 'absent' } })
  expect(within(dialog).getByText('No verbs match this selection.')).toBeInTheDocument()
})

test('a compartment round keeps its server box scope, drains cleanly and never replays a stale zero-score completion', async () => {
  const actions = sitovActions()
  actions.next = jest.fn().mockResolvedValueOnce({ data: sitovExercise }).mockResolvedValue({ data: null })
  render(<VerbTrainerClient initialState={sitovState} lang="en" actions={actions} />)
  fireEvent.click(screen.getByRole('button', { name: 'Open Box 1 · New' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Practise this compartment' }))
  fireEvent.change(await screen.findByRole('textbox', { name: 'Your answer 1' }), { target: { value: 'fährst' } })
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Next form' }))
  expect(await screen.findByRole('heading', { name: 'One round further.' })).toBeInTheDocument()
  expect(actions.next).toHaveBeenLastCalledWith({ level: 'A1.2', tenses: ['present', 'perfect'], excludeVerbId: 'sitov-fahren', box: 1, verbIds: ['sitov-fahren'] }, 'en')
  fireEvent.click(screen.getByRole('button', { name: 'Another round' }))
  expect(await screen.findByRole('heading', { name: 'More forms are still ready.' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'One round further.' })).not.toBeInTheDocument()
  expect(actions.next).toHaveBeenCalledTimes(3)
})

test('a failed inspector removal closes the modal so access errors and reload remain operable', async () => {
  const actions = sitovActions()
  actions.box = jest.fn().mockResolvedValue({ error: 'not_authorized' })
  render(<VerbTrainerClient initialState={sitovState} lang="en" actions={actions} />)
  const opener = screen.getByRole('button', { name: 'Open Box 1 · New' })
  fireEvent.click(opener)
  fireEvent.click(await screen.findByRole('button', { name: 'Remove from verb box: fahren' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByRole('alert')).toHaveTextContent('Your access has changed')
  expect(screen.getByRole('button', { name: 'Reload' })).toBeEnabled()
  expect(opener).toHaveFocus()
  expect(screen.getByRole('region', { name: 'Your verb learning box' }).querySelector('[data-sitov-stat="verbs"]')).toHaveTextContent('1')
})

test('automatic practice after a compartment round clears the previous server box filter', async () => {
  const actions = sitovActions()
  render(<VerbTrainerClient initialState={sitovState} lang="en" actions={actions} />)
  fireEvent.click(screen.getByRole('button', { name: 'Open Box 1 · New' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Practise this compartment' }))
  await screen.findByRole('textbox', { name: 'Your answer 1' })
  fireEvent.click(screen.getByRole('button', { name: 'End round' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Back to verb trainer' }))
  fireEvent.click(sitovHeroButton())
  await screen.findByRole('textbox', { name: 'Your answer 1' })
  expect(actions.next).toHaveBeenLastCalledWith({ level: 'A1.2', tenses: ['present', 'perfect'], excludeVerbId: undefined }, 'en')
})


test('wrong forms return after the due queue and repeat until correct without scoring twice', async () => {
  const second = { ...sitovExercise, exerciseId: '7f7fe973-9525-48b7-8aee-795211236120', verbId: 'sitov-lernen', infinitive: 'lernen' }
  const wrong = { ...sitovReview, correct: false, progress: { ...sitovReview.progress, box: 1, correct: 0, lapses: 1 } }
  const actions = sitovActions()
  actions.next = jest.fn().mockResolvedValueOnce({ data: sitovExercise }).mockResolvedValueOnce({ data: second }).mockResolvedValue({ data: null })
  actions.answer = jest.fn().mockResolvedValueOnce({ data: wrong }).mockResolvedValueOnce({ data: { ...sitovReview, progress: { ...sitovReview.progress, verbId: second.verbId } } })
  actions.retry = jest.fn().mockResolvedValueOnce({ data: { ...wrong, retry: true } }).mockResolvedValueOnce({ data: { ...wrong, correct: true, retry: true } })
  const state = { ...sitovState, selectedIds: ['sitov-fahren', 'sitov-lernen'], verbs: [...sitovState.verbs, { ...sitovState.verbs[0], id: 'sitov-lernen', infinitive: 'lernen' }] }
  render(<VerbTrainerClient initialState={state} lang="en" actions={actions} />)
  fireEvent.click(sitovHeroButton())
  fireEvent.click(await screen.findByRole('button', { name: 'Show solution' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Next form' }))
  expect(await screen.findByRole('heading', { name: 'lernen' })).toBeInTheDocument()
  fireEvent.change(screen.getByRole('textbox', { name: 'Your answer 1' }), { target: { value: 'lernst' } })
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Next form' }))
  expect(await screen.findByText('Repeat')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'fahren' })).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Your round' })).toHaveAttribute('aria-valuenow', '2')
  fireEvent.click(screen.getByRole('button', { name: 'Show solution' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Next form' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Your answer 1' }), { target: { value: 'fährst' } })
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
  fireEvent.click(await screen.findByRole('button', { name: 'End round' }))
  expect(await screen.findByRole('heading', { name: 'One round further.' })).toBeInTheDocument()
  expect(screen.getByText('1', { selector: 'strong' })).toHaveTextContent('1 / 2')
  expect(actions.answer).toHaveBeenCalledTimes(2)
  expect(actions.retry).toHaveBeenCalledTimes(2)
  expect(actions.retry).toHaveBeenNthCalledWith(1, { exerciseId: sitovExercise.exerciseId, answer: [''] })
  expect(actions.retry).toHaveBeenNthCalledWith(2, { exerciseId: sitovExercise.exerciseId, answer: ['fährst'] })
  expect(actions.next).toHaveBeenCalledTimes(3)
})

test('archive forms have no scheduled date or practice action', async () => {
  const learned = { ...sitovReview.progress, box: 7, nextReviewAt: null }
  const state = { ...sitovState, progress: [learned, { ...learned, tense: 'perfect' as const }] }
  render(<VerbTrainerClient initialState={state} lang="en" actions={sitovActions()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Open Learned' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).queryByText('Next scheduled review')).not.toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: 'Practise this compartment' })).not.toBeInTheDocument()
  expect(within(dialog).getAllByText(/archive|no more reviews/i)).toHaveLength(2)
})

test('a round freezes the shared vocabulary size until the next start', async () => {
  const { saveRoundSize } = await import('@/lib/vocabulary-lernkasten')
  saveRoundSize(10)
  const many = Array.from({ length: 15 }, (_, i) => ({ ...sitovState.verbs[0], id: `sitov-verb-${i}` }))
  const actions = sitovActions()
  render(<VerbTrainerClient initialState={{ ...sitovState, verbs: many, selectedIds: many.map(verb => verb.id) }} lang="en" actions={actions} />)
  fireEvent.click(sitovHeroButton())
  await screen.findByRole('textbox', { name: 'Your answer 1' })
  expect(screen.getByRole('progressbar', { name: 'Your round' })).toHaveAttribute('aria-valuemax', '10')
  const { act } = await import('@testing-library/react')
  act(() => saveRoundSize(30))
  expect(screen.getByRole('progressbar', { name: 'Your round' })).toHaveAttribute('aria-valuemax', '10')
  fireEvent.click(screen.getByRole('button', { name: 'End round' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Another round' }))
  await screen.findByRole('textbox', { name: 'Your answer 1' })
  expect(screen.getByRole('progressbar', { name: 'Your round' })).toHaveAttribute('aria-valuemax', '30')
  act(() => saveRoundSize(20))
})


test('accepted spelling errors show the localized shared correction badge', async () => {
  const actions = sitovActions()
  actions.answer = jest.fn().mockResolvedValue({ data: { ...sitovReview, softError: 'umlaut' } })
  render(<VerbTrainerClient initialState={sitovState} lang="en" actions={actions} />)
  fireEvent.click(sitovHeroButton())
  fireEvent.change(await screen.findByRole('textbox', { name: 'Your answer 1' }), { target: { value: 'faehrst' } })
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
  expect(await screen.findByText(getSitovVerbCopy('en').softUmlaut)).toBeInTheDocument()
  expect(screen.queryByText('Got it!')).not.toBeInTheDocument()
})

test('deferred siblings remain ready instead of being reported as fully completed', async () => {
  const actions = sitovActions()
  actions.next = jest.fn().mockResolvedValue({ data: null })
  render(<VerbTrainerClient initialState={sitovState} lang="en" actions={actions} />)
  fireEvent.click(sitovHeroButton())
  expect(await screen.findByRole('heading', { name: 'More forms are still ready.' })).toBeInTheDocument()
  expect(screen.getByText('Practise another verb first.')).toBeInTheDocument()
  expect(screen.queryByText('All done for now.')).not.toBeInTheDocument()
})
