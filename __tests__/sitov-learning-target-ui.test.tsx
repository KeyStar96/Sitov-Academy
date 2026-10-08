import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import LessonCardsModal from '@/components/vocabulary/LessonCardsModal'
import VerbTrainerClient, { type SitovVerbTrainerActions } from '@/components/verbs/VerbTrainerClient'
import { getLessonCards, addCardsToTrainer, resetLessonProgress } from '@/app/actions/vocabulary'
import { getSitovVerbById } from '@/lib/verbs/catalog'
import { sitovLearningTargetCopy } from '@/lib/learning/sitov-learning-target-i18n'
import type { SitovVerbTrainerState } from '@/lib/verbs/contracts'
jest.unmock('lucide-react')
jest.mock('@/app/actions/vocabulary', () => ({ getLessonCards: jest.fn(), addCardsToTrainer: jest.fn(), addOwnWord: jest.fn(), deleteOwnWord: jest.fn(), resetLessonProgress: jest.fn() }))
jest.mock('@/app/actions/verbs', () => ({ nextSitovVerbExercise: jest.fn(), setSitovVerbBox: jest.fn(), submitSitovVerbAnswer: jest.fn(), checkSitovVerbRetry: jest.fn() }))
const verb = { ...getSitovVerbById('sitov-verb-fahren')!, unitId: 'unit' }
const state: SitovVerbTrainerState = { learnerId: 'learner', level: 'A1.1', authorizedLevels: ['A1.1'], tenses: ['present'], verbs: [verb], selectedIds: [], progress: [] }
const actions = { next: jest.fn().mockResolvedValue({ data: null }), box: jest.fn().mockResolvedValue({ data: { selectedIds: [verb.id] } }), answer: jest.fn(), retry: jest.fn() } as SitovVerbTrainerActions
beforeEach(() => { jest.clearAllMocks(); jest.mocked(getLessonCards).mockResolvedValue([{ id: 'exact', word_de: 'Haus', article: 'das', plural: null, translation: 'house', image_url: null, audio_url: null, phase: null, isLearned: false }]) })
test('focuses exact existing card without adding or resetting', async () => {
  render(<LessonCardsModal lesson="Echte Lektion" level="A1.1" uiLanguage="en" focusCardId="exact" onClose={jest.fn()} onCardAdded={jest.fn()} />)
  await waitFor(() => expect(screen.getByRole('listitem', { name: 'Selected learning target: das Haus' })).toHaveFocus())
  expect(getLessonCards).toHaveBeenCalledWith('Echte Lektion', 'A1.1', 'en'); expect(addCardsToTrainer).not.toHaveBeenCalled(); expect(resetLessonProgress).not.toHaveBeenCalled()
  expect(screen.getByText('das Haus')).toHaveAttribute('translate', 'no')
})
test.each(['de', 'en', 'ru', 'uk', 'tr'])('missing exact card has localized error in %s', async lang => {
  render(<LessonCardsModal lesson="Echte Lektion" level="A1.1" uiLanguage={lang} focusCardId="revoked" onClose={jest.fn()} onCardAdded={jest.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent(sitovLearningTargetCopy(lang).unavailable); expect(addCardsToTrainer).not.toHaveBeenCalled()
})
test('opening unselected verb is readonly and add is explicit', async () => {
  render(<VerbTrainerClient initialState={state} lang="en" sitovTarget={{ target: verb.id }} actions={actions} />)
  expect(actions.box).not.toHaveBeenCalled(); expect(actions.next).not.toHaveBeenCalled()
  expect(screen.getByRole('listitem', { name: /Selected learning target/ })).toHaveFocus()
  const buttons = screen.getAllByRole('button', { name: /Add/ }); fireEvent.click(buttons[buttons.length - 1]); await waitFor(() => expect(screen.getByRole('button', { name: /Remove/ })).toHaveAttribute('aria-pressed', 'true')); expect(actions.box).toHaveBeenCalledWith({ level: 'A1.1', verbIds: [verb.id], selected: true })
})
test('practice restricts selected due verb to exact ID and present without requiring a box', async () => {
  render(<VerbTrainerClient initialState={{ ...state, selectedIds: [verb.id] }} lang="en" sitovTarget={{ target: verb.id }} actions={actions} />)
  fireEvent.click(screen.getByRole('button', { name: sitovLearningTargetCopy('en').practice }))
  await waitFor(() => expect(actions.next).toHaveBeenCalledWith({ level: 'A1.1', tenses: ['present'], excludeVerbId: undefined, verbIds: [verb.id] }, 'en'))
  expect(actions.box).not.toHaveBeenCalled()
})
test('future review is shown honestly and cannot start a due round', () => {
  render(<VerbTrainerClient initialState={{ ...state, selectedIds: [verb.id], progress: [{ verbId: verb.id, tense: 'present', box: 3, attempts: 5, correct: 5, lapses: 0, nextReviewAt: '2099-01-01T00:00:00Z', lastAnsweredAt: '2026-10-08T00:00:00Z' }] }} lang="en" sitovTarget={{ target: verb.id }} actions={actions} />)
  expect(screen.getByRole('status')).toHaveTextContent(sitovLearningTargetCopy('en').noDue); expect(screen.queryByRole('button', { name: sitovLearningTargetCopy('en').practice })).not.toBeInTheDocument(); expect(actions.next).not.toHaveBeenCalled()
})

test('unavailable verb has no fallback card or exercise actions', () => {
  render(<VerbTrainerClient initialState={state} lang="tr" sitovTarget={{ error: 'unavailable' }} actions={actions} />)
  expect(screen.getByRole('alert')).toHaveTextContent(sitovLearningTargetCopy('tr').unavailable)
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument(); expect(actions.box).not.toHaveBeenCalled(); expect(actions.next).not.toHaveBeenCalled()
})
