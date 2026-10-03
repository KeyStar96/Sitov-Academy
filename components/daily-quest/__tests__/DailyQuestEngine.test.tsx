import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SVGProps } from 'react'
import DailyQuestEngine, { type DailyQuestActions } from '../DailyQuestEngine'
import BakeryJourney from '@/components/journey/BakeryJourney'
import { cachedNeuralAudio, resolveNeuralAudio } from '@/lib/audio/neural-client'
import type { DailyQuest, DailyQuestStepResult, DailyQuestStreak } from '@/lib/daily-quest-contract'
import { getDailyQuestCopy } from '@/lib/daily-quest-i18n'
import { skipDailyQuest } from '@/app/actions/daily-quests'

const replace = jest.fn()
const refresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }))
jest.mock('@/app/actions/daily-quests', () => ({ submitDailyQuestStep: jest.fn(), completeDailyQuest: jest.fn(), skipDailyQuest: jest.fn() }))
jest.mock('@/lib/audio/neural-client', () => ({
  cachedNeuralAudio: jest.fn(), resolveNeuralAudio: jest.fn(), invalidateNeuralAudio: jest.fn(),
  neuralAudioKey: (source: { text: string; voice?: string }) => JSON.stringify([source.text, source.voice]),
}))
jest.mock('lucide-react', () => {
  const Icon = (props: SVGProps<SVGSVGElement>) => <svg {...props} />
  return Object.fromEntries(['ArrowRight', 'ArrowUpRight', 'BookOpen', 'Check', 'Coffee', 'Compass', 'Flame', 'Loader2', 'MapPin', 'MessageCircle', 'Pause', 'RotateCcw', 'ShoppingBag', 'Sparkles', 'Sun', 'Undo2', 'Volume2'].map(name => [name, Icon]))
})
jest.mock('next/image', () => ({ __esModule: true, default: ({ fill, preload, priority, ...props }: { fill?: boolean; preload?: boolean; priority?: boolean; src: string; alt: string }) => {
  void fill; void preload; void priority
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={props.alt} />
} }))

const streak: DailyQuestStreak = { current: 4, longest: 7, lastCompletedDate: '2026-10-01' }
function quest(): DailyQuest {
  return {
    id: '1de39a12-9c34-4028-8e53-0af471e76254', date: '2026-10-02', status: 'active', level: 'A1', templateKey: 'test-scene',
    title: 'Ein neuer Alltag', subtitle: 'Heute lernst du im Café.',
    scene: { backgroundKey: 'test_scene', backgroundImage: '/Bilder/deutschreise/new-scene.webp', imageAlt: 'Eine neue Alltagsszene', location: 'Berlin', audioText: 'Willkommen! Was darf es sein?', speakerId: 'person', characters: [{ id: 'person', name: 'Lea', voice: 'female' }, { id: 'learner', name: 'Alex', voice: 'male' }] },
    personalization: { source: 'fallback', cardId: null },
    steps: [
      { id: 'words', kind: 'discover', instruction: 'Entdecke das Wort.', words: [{ id: 'tea', text: 'der Tee', audioText: 'Der Tee. Ein Tee.' }] },
      { id: 'sentence', kind: 'sentence_build', speakerId: 'learner', prompt: 'Baue deine Bestellung.', pieces: [{ id: 'please', text: 'bitte' }, { id: 'tea', text: 'Einen Tee' }], audioText: 'Einen Tee bitte.' },
      { id: 'talk', kind: 'dialogue_choice', speakerId: 'person', prompt: 'Antworte freundlich.', options: [{ id: 'yes', text: 'Ja, bitte.' }, { id: 'evening', text: 'Guten Abend.' }], audioText: 'Möchten Sie Zucker?' },
    ], completedStepIds: [], completion: { title: 'Dein Teemoment', text: 'Du hast deinen Tee bestellt.' },
  }
}
function actions(): jest.Mocked<DailyQuestActions> {
  return { submit: jest.fn(), complete: jest.fn() }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(next => { resolve = next })
  return { promise, resolve }
}
function mount(initialQuest = quest(), callbacks = actions()) {
  return { ...render(<DailyQuestEngine initialQuest={initialQuest} initialStreak={streak} locale="de" dashboardHref="/de/dashboard" actions={callbacks} />), callbacks }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(cachedNeuralAudio).mockReturnValue(null)
  jest.mocked(resolveNeuralAudio).mockResolvedValue('/voice.wav')
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function () {
    this.dispatchEvent(new Event('playing'))
    return Promise.resolve()
  })
  localStorage.clear()
})
afterEach(() => jest.restoreAllMocks())

it('renders an authored image and keeps scene speech separate from a selected word', async () => {
  mount()
  expect(screen.getByAltText('Eine neue Alltagsszene')).toHaveAttribute('src', '/Bilder/deutschreise/new-scene.webp')
  expect(screen.getByText('0 von 3 Stationen')).toBeInTheDocument()
  expect(screen.getAllByText('Heute lernst du im Café.')).toHaveLength(1)
  expect(resolveNeuralAudio).not.toHaveBeenCalled()
  expect(document.activeElement).not.toBe(screen.getByRole('heading', { name: 'Ein kleiner Moment Deutsch' }))
  fireEvent.click(screen.getByRole('button', { name: 'Los geht’s' }))
  expect(screen.getByRole('heading', { name: 'Wörter entdecken' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'der Tee' }))
  fireEvent.click(screen.getByRole('button', { name: 'Wort anhören' }))
  await waitFor(() => expect(resolveNeuralAudio).toHaveBeenCalledWith({ text: 'Der Tee. Ein Tee.', language: 'de', voice: 'female' }, false))
  fireEvent.click(screen.getByRole('button', { name: 'Szene anhören' }))
  await waitFor(() => expect(resolveNeuralAudio).toHaveBeenLastCalledWith({ text: 'Willkommen! Was darf es sein?', language: 'de', voice: 'female' }, false))
})

it('resumes the first unverified station and keeps a male character voice', async () => {
  const initial = quest()
  initial.completedStepIds = ['words']
  mount(initial)
  expect(screen.queryByRole('button', { name: 'Los geht’s' })).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Deinen Satz bauen' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Satz anhören' }))
  await waitFor(() => expect(resolveNeuralAudio).toHaveBeenCalledWith({ text: 'Einen Tee bitte.', language: 'de', voice: 'male' }, false))
})

it('submits discovered word IDs, supports sentence undo/reset, and uses server grading for progression', async () => {
  const initial = quest(); const callbacks = actions()
  callbacks.submit.mockResolvedValueOnce({ data: { success: true, correct: true, feedback: 'Wort entdeckt.', quest: { ...initial, completedStepIds: ['words'] }, streak } })
  callbacks.submit.mockResolvedValueOnce({ data: { success: true, correct: false, feedback: 'Die Reihenfolge passt noch nicht.', quest: { ...initial, completedStepIds: ['words'] }, streak } })
  callbacks.submit.mockResolvedValueOnce({ data: { success: true, correct: true, feedback: 'Deine Bestellung passt.', quest: { ...initial, completedStepIds: ['words', 'sentence'] }, streak } })
  mount(initial, callbacks)
  fireEvent.click(screen.getByRole('button', { name: 'Los geht’s' }))
  expect(screen.getByRole('button', { name: 'Prüfen' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'der Tee' }))
  fireEvent.click(screen.getByRole('button', { name: 'Prüfen' }))
  expect(callbacks.submit).toHaveBeenLastCalledWith({ assignmentId: initial.id, stepId: 'words', answer: { wordIds: ['tea'] } })
  fireEvent.click(await screen.findByRole('button', { name: 'Weiter' }))
  fireEvent.click(screen.getByRole('button', { name: 'bitte' }))
  fireEvent.click(screen.getByRole('button', { name: 'Einen Tee' }))
  fireEvent.click(screen.getByRole('button', { name: 'Zurücknehmen' }))
  expect(screen.getByRole('button', { name: 'Prüfen' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Neu legen' }))
  expect(screen.getByText('Tippe die Wörter in der passenden Reihenfolge an.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'bitte' }))
  fireEvent.click(screen.getByRole('button', { name: 'Einen Tee' }))
  fireEvent.click(screen.getByRole('button', { name: 'Prüfen' }))
  expect(await screen.findByText('Die Reihenfolge passt noch nicht.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Weiter' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Neu legen' }))
  fireEvent.click(screen.getByRole('button', { name: 'Einen Tee' }))
  fireEvent.click(screen.getByRole('button', { name: 'bitte' }))
  fireEvent.click(screen.getByRole('button', { name: 'Prüfen' }))
  expect(callbacks.submit).toHaveBeenLastCalledWith({ assignmentId: initial.id, stepId: 'sentence', answer: { pieceIds: ['tea', 'please'] } })
  fireEvent.click(await screen.findByRole('button', { name: 'Weiter' }))
  expect(screen.getByRole('heading', { name: 'Im Gespräch' })).toBeInTheDocument()
})

it('renders a separate comma next to its word while preserving the submitted piece IDs', async () => {
  const initial = quest(); initial.completedStepIds = ['words']
  initial.steps[1] = { id: 'sentence', kind: 'sentence_build', speakerId: 'learner', prompt: 'Bestelle höflich.',
    pieces: [{ id: 'intro', text: 'Ich möchte' }, { id: 'roll', text: 'ein Brötchen' }, { id: 'comma', text: ',' }, { id: 'please', text: 'bitte.' }], audioText: 'Ich möchte ein Brötchen, bitte.' }
  const callbacks = actions()
  callbacks.submit.mockResolvedValueOnce({ data: { success: true, correct: true, feedback: 'Deine Bestellung passt.', quest: { ...initial, completedStepIds: ['words', 'sentence'] }, streak } })
  mount(initial, callbacks)
  for (const text of ['Ich möchte', 'ein Brötchen', ',', 'bitte.']) fireEvent.click(screen.getByRole('button', { name: text }))
  expect(screen.getByLabelText('Dein Satz').textContent).toBe('Ich möchte ein Brötchen, bitte.')
  fireEvent.click(screen.getByRole('button', { name: 'Prüfen' }))
  expect(callbacks.submit).toHaveBeenCalledWith({ assignmentId: initial.id, stepId: 'sentence', answer: { pieceIds: ['intro', 'roll', 'comma', 'please'] } })
  expect(await screen.findByText('Deine Bestellung passt.')).toBeInTheDocument()
})

it('requires the server result, prevents duplicate grading, and lets the student retry', async () => {
  const initial = quest()
  initial.completedStepIds = ['words', 'sentence']
  const callbacks = actions()
  const pending = deferred<{ data: DailyQuestStepResult }>()
  callbacks.submit.mockReturnValueOnce(pending.promise)
  mount(initial, callbacks)
  fireEvent.click(screen.getByRole('button', { name: 'Ja, bitte.' }))
  fireEvent.click(screen.getByRole('button', { name: 'Ja, bitte.' }))
  expect(callbacks.submit).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: 'Reise abschließen' })).not.toBeInTheDocument()
  await act(async () => pending.resolve({ data: { success: true, correct: false, feedback: 'Bitte prüfe die Frage noch einmal.', quest: initial, streak } }))
  expect(screen.getByText('Bitte prüfe die Frage noch einmal.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ja, bitte.' })).toBeEnabled()
  callbacks.submit.mockResolvedValueOnce({ data: { success: true, correct: true, feedback: 'Das passt.', quest: { ...initial, completedStepIds: ['words', 'sentence', 'talk'] }, streak } })
  fireEvent.click(screen.getByRole('button', { name: 'Ja, bitte.' }))
  const finish = await screen.findByRole('button', { name: 'Reise abschließen' })
  await waitFor(() => expect(finish).toHaveFocus())
})

it('does not unlock a station from a correct flag without server completion', async () => {
  const initial = quest(); initial.completedStepIds = ['words', 'sentence']
  const callbacks = actions()
  callbacks.submit.mockResolvedValue({ data: { success: true, correct: true, feedback: 'Antwort erhalten.', quest: initial, streak } })
  mount(initial, callbacks)
  fireEvent.click(screen.getByRole('button', { name: 'Ja, bitte.' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Das hat gerade nicht geklappt.')
  expect(screen.queryByRole('button', { name: 'Reise abschließen' })).not.toBeInTheDocument()
})

it('announces a recoverable server error and only shows the database streak after completion', async () => {
  const initial = quest(); initial.completedStepIds = ['words', 'sentence', 'talk']
  const callbacks = actions()
  callbacks.complete.mockResolvedValueOnce({ error: 'unavailable' })
  callbacks.complete.mockResolvedValueOnce({ data: { success: true, quest: { ...initial, status: 'completed' }, streak: { ...streak, current: 12 } } })
  mount(initial, callbacks)
  fireEvent.click(screen.getByRole('button', { name: 'Reise abschließen' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Versuche es noch einmal.')
  expect(screen.queryByText('12')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reise abschließen' }))
  expect(await screen.findByText('12')).toBeInTheDocument()
  expect(callbacks.complete).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getAllByRole('button', { name: 'Zur Übersicht' })[1])
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/de/dashboard'))
  expect(refresh).toHaveBeenCalled()
})

it('returns home without a skip mutation and resumes verified station progress on re-entry', async () => {
  const initial = quest(); const callbacks = actions()
  initial.completedStepIds = ['words']
  const { unmount } = mount(initial, callbacks)
  fireEvent.click(screen.getByRole('button', { name: 'Später machen' }))
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/de/dashboard'))
  expect(skipDailyQuest).not.toHaveBeenCalled()
  expect(callbacks.submit).not.toHaveBeenCalled()
  expect(callbacks.complete).not.toHaveBeenCalled()
  expect(initial.status).toBe('active')
  unmount()
  mount(initial, callbacks)
  expect(screen.getByRole('heading', { name: 'Deinen Satz bauen' })).toBeInTheDocument()
  expect(screen.getByText('1 von 3 Stationen')).toBeInTheDocument()
})

it('labels the teacher preview and shows no student streak in its completion screen', () => {
  const initial = quest(); initial.status = 'completed'; initial.completedStepIds = ['words', 'sentence', 'talk']
  render(<DailyQuestEngine initialQuest={initial} initialStreak={streak} locale="de" dashboardHref="/de/admin" actions={actions()} preview />)
  expect(screen.getByText(getDailyQuestCopy('de').previewNotice)).toBeInTheDocument()
  expect(screen.queryByText('Tage in Folge')).not.toBeInTheDocument()
  expect(screen.queryByText('4')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Dein Teemoment' })).toBeInTheDocument()
})

it('fixes the original bakery word/scene audio-source regression', async () => {
  const speak = jest.fn().mockResolvedValue(undefined)
  render(<BakeryJourney homeHref="/de" onSpeak={speak} />)
  fireEvent.click(screen.getByRole('button', { name: 'Bäckerei betreten' }))
  fireEvent.click(screen.getByRole('button', { name: 'das Brötchen' }))
  fireEvent.click(screen.getByRole('button', { name: 'Wort anhören' }))
  await waitFor(() => expect(speak).toHaveBeenLastCalledWith('Das Brötchen. Ein Brötchen.'))
  fireEvent.click(screen.getByRole('button', { name: 'Deutsche Referenz anhören' }))
  await waitFor(() => expect(speak).toHaveBeenLastCalledWith('Guten Morgen! Was darf es sein?'))
})
