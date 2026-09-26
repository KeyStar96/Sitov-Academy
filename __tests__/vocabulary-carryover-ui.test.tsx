import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import VocabularyStartGate from '@/components/vocabulary/VocabularyStartGate'
import VocabularyCarryoverStation from '@/components/vocabulary/VocabularyCarryoverStation'
import VocabularyTrainingStart from '@/components/vocabulary/VocabularyTrainingStart'
import VocabCardSession from '@/components/vocabulary/VocabCardSession'
import VocabTrainerPageClient from '@/components/vocabulary/VocabTrainerPageClient'
import LeitnerBoxOverview from '@/components/vocabulary/LeitnerBoxOverview'
import VocabularyAssessPage from '@/app/[lang]/dashboard/level/[level]/vocabulary/assess/page'
import VocabularyTrainPage from '@/app/[lang]/dashboard/level/[level]/vocabulary/train/page'
import { beginVocabularyLevel, setVocabularyCarryover, getVocabularySession, getVocabularyAssessment, getVocabularyCarryover } from '@/app/actions/vocabulary'
import { announceVocabularyCarryoverChange } from '@/lib/learning-reset-events'
import { getDictionary } from '@/lib/dictionary'
import { carryoverTranslator, VOCABULARY_CARRYOVER_MESSAGES } from '@/lib/vocabulary-carryover-i18n'
import { summarizeBox, computeWordBoxState } from '@/lib/vocabulary-box'
import type { VocabularyCarryoverSummary, DueVocabularyCard } from '@/lib/types/vocabulary'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'

jest.unmock('lucide-react')
jest.mock('@/app/actions/vocabulary', () => ({ beginVocabularyLevel: jest.fn(), setVocabularyCarryover: jest.fn(), getVocabularySession: jest.fn(), getVocabularyAssessment: jest.fn(), getVocabularyCarryover: jest.fn(), getPhaseCards: jest.fn() }))
jest.mock('@/lib/learning-reset-events', () => ({ announceVocabularyCarryoverChange: jest.fn() }))
jest.mock('@/lib/dictionary', () => ({ getDictionary: jest.fn() }))
jest.mock('@/components/vocabulary/VocabCardSession', () => ({ __esModule: true, default: jest.fn(() => <p>Round is ready</p>) }))
jest.mock('@/app/[lang]/dashboard/level/[level]/vocabulary/assess/LessonAssessmentClient', () => ({ __esModule: true, default: () => <p>Assessment is ready</p> }))
const refresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: jest.fn() }) }))

const learnerId = '00000000-0000-4000-8000-000000000001'
const phase3 = computeWordBoxState([
  { direction: 'de_to_native', box_number: 3, next_review_date: '2020-01-01' },
  { direction: 'native_to_de', box_number: 3, next_review_date: '2020-01-01' },
])!
const summary: VocabularyCarryoverSummary = {
  targetLevel: 'A1.2', enabled: false, startedAt: null, decidedAt: null, promptRequired: true, total: 1,
  byLevel: [{ level: 'A1.1', total: 1, box: summarizeBox([phase3]) }],
}
const card: DueVocabularyCard = {
  progressId: 'progress', targetLevel: 'A1.2', originLevel: 'A1.1', direction: 'native_to_de', box: 3, phase: 3, mode: 'typed', format: 'word', prompt: 'bread', promptLanguage: 'en', contextSentence: null, solution: null, translation: 'bread', isHardForNativeLanguage: false,
  card: { id: 'word', level: 'A1.1', lesson: 'Lektion 1', word_de: 'Brot', article: 'das', plural: 'Brote', image_url: null, audio_url: null },
}
const t = carryoverTranslator('de')

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  jest.mocked(beginVocabularyLevel).mockReset().mockResolvedValue({ success: true, carryover: summary })
  jest.mocked(setVocabularyCarryover).mockReset().mockImplementation(async (_level, enabled) => ({ success: true, carryover: { ...summary, enabled, decidedAt: '2026-09-26', promptRequired: false } }))
  jest.mocked(getVocabularySession).mockResolvedValue({ learnerId, cards: [card], deferredCount: 0, previousCardId: null })
  jest.mocked(getDictionary).mockResolvedValue(en)
  jest.mocked(getVocabularyCarryover).mockReset().mockResolvedValue(summary)
  jest.mocked(getVocabularyAssessment).mockResolvedValue({ learnerId, cards: [{ id: 'new-word', word_de: 'lernen', article: null, plural: null, translation: 'learn', translationLanguage: 'en', direction: 'native_to_de' }] })
})

it('does not record a learning start or ask the question while browsing the box', () => {
  render(<VocabTrainerPageClient learnerId={learnerId} initialCards={[card]} boxSummary={summarizeBox([phase3])} lang="de" level="A1.2" translations={de.vocabulary} carryover={summary} />)
  expect(beginVocabularyLevel).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('asks after starting a round, keeps decline left and accept right, then refreshes the actual queue', async () => {
  render(<VocabTrainerPageClient learnerId={learnerId} initialCards={[{ ...card, originLevel: undefined }]} boxSummary={summarizeBox([phase3])} lang="de" level="A1.2" translations={de.vocabulary} />)
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.lernkasten_start_count_one }))
  const dialog = await screen.findByRole('dialog', { name: t('question', { count: 1, levels: 'A1.1' }) })
  expect(beginVocabularyLevel).toHaveBeenCalledWith('A1.2', learnerId)
  expect(VocabCardSession).not.toHaveBeenCalled()
  const decline = within(dialog).getByRole('button', { name: t('decline') })
  const accept = within(dialog).getByRole('button', { name: t('accept') })
  expect(decline.compareDocumentPosition(accept) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  accept.focus()
  fireEvent.keyDown(document, { key: 'Tab' })
  expect(decline).toHaveFocus()
  await act(async () => fireEvent.click(accept))
  expect(setVocabularyCarryover).toHaveBeenCalledWith('A1.2', true, learnerId)
  expect(announceVocabularyCarryoverChange).toHaveBeenCalledWith(learnerId)
  expect(getVocabularySession).toHaveBeenCalledWith('A1.2', 'de')
  expect(jest.mocked(VocabCardSession).mock.calls[0][0]).toMatchObject({ cards: [card], level: 'A1.2' })
})

it('also gates a direct training link and includes carried cards in a lesson-specific round', async () => {
  render(<VocabularyTrainingStart level="A1.2" lesson="Lektion 2" learnerId={learnerId} cards={[]} uiLanguage="en" overviewHref="/en/dashboard/level/A1.2/vocabulary" />)
  const accept = await screen.findByRole('button', { name: 'Bring along' })
  await act(async () => fireEvent.click(accept))
  expect(jest.mocked(VocabCardSession).mock.calls[0][0]).toMatchObject({ cards: [card], level: 'A1.2' })
})

it('asks before the first direct assessment can accept an answer', async () => {
  render(await VocabularyAssessPage({ params: Promise.resolve({ lang: 'en', level: 'A1.2' }), searchParams: Promise.resolve({ lesson: 'Lektion 2' }) }))
  expect(screen.queryByText('Assessment is ready')).not.toBeInTheDocument()
  const decline = await screen.findByRole('button', { name: 'No, thanks' })
  await act(async () => fireEvent.click(decline))
  expect(setVocabularyCarryover).toHaveBeenCalledWith('A1.2', false, learnerId)
  expect(screen.getByText('Assessment is ready')).toBeInTheDocument()
})

it('does not consume first learning start when a direct training route and earlier levels are empty', async () => {
  jest.mocked(getVocabularySession).mockResolvedValue({ learnerId, cards: [], deferredCount: 0, previousCardId: null })
  jest.mocked(getVocabularyCarryover).mockResolvedValue({ ...summary, total: 0, byLevel: [], promptRequired: false })
  render(await VocabularyTrainPage({ params: Promise.resolve({ lang: 'en', level: 'A1.2' }), searchParams: Promise.resolve({}) }))
  expect(screen.getByText('Round is ready')).toBeInTheDocument()
  expect(getVocabularyCarryover).toHaveBeenCalledWith('A1.2')
  expect(beginVocabularyLevel).not.toHaveBeenCalled()
})

it('still asks in an empty target when earlier words can populate the first round', async () => {
  jest.mocked(getVocabularySession).mockResolvedValueOnce({ learnerId, cards: [], deferredCount: 0, previousCardId: null })
  render(await VocabularyTrainPage({ params: Promise.resolve({ lang: 'en', level: 'A1.2' }), searchParams: Promise.resolve({}) }))
  const accept = await screen.findByRole('button', { name: 'Bring along' })
  expect(VocabCardSession).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(accept))
  expect(jest.mocked(VocabCardSession).mock.calls[0][0]).toMatchObject({ cards: [card], level: 'A1.2' })
})

it('does not consume first assessment start when there are no words to assess', async () => {
  jest.mocked(getVocabularyAssessment).mockResolvedValueOnce({ learnerId, cards: [] })
  render(await VocabularyAssessPage({ params: Promise.resolve({ lang: 'en', level: 'A1.2' }), searchParams: Promise.resolve({ lesson: 'Lektion 2' }) }))
  expect(screen.getByText(en.vocabulary.assess_empty_title)).toBeInTheDocument()
  expect(beginVocabularyLevel).not.toHaveBeenCalled()
})

it('persists decline and uses the saved decision on the next learning start', async () => {
  const view = render(<VocabularyStartGate level="A1.2" lang="de" learnerId={learnerId}><p>Ready</p></VocabularyStartGate>)
  const decline = await screen.findByRole('button', { name: t('decline') })
  await act(async () => fireEvent.click(decline))
  expect(setVocabularyCarryover).toHaveBeenCalledWith('A1.2', false, learnerId)
  view.unmount()
  jest.mocked(beginVocabularyLevel).mockResolvedValue({ success: true, carryover: { ...summary, promptRequired: false, decidedAt: '2026-09-26' } })
  render(<VocabularyStartGate level="A1.2" lang="de" learnerId={learnerId}><p>Ready again</p></VocabularyStartGate>)
  expect(await screen.findByText('Ready again')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(setVocabularyCarryover).toHaveBeenCalledTimes(1)
})

it('keeps the question open after a failed save and retries the decision', async () => {
  jest.mocked(setVocabularyCarryover).mockResolvedValueOnce({ success: false, error: 'save_failed' })
  render(<VocabularyStartGate level="A1.2" lang="de" learnerId={learnerId}><p>Ready</p></VocabularyStartGate>)
  const accept = await screen.findByRole('button', { name: t('accept') })
  await act(async () => fireEvent.click(accept))
  expect(screen.getByRole('alert')).toHaveTextContent(t('error'))
  expect(screen.queryByText('Ready')).not.toBeInTheDocument()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: t('accept') })))
  expect(screen.getByText('Ready')).toBeInTheDocument()
})

it('shows an explicit start failure and lets the learner retry before studying', async () => {
  jest.mocked(beginVocabularyLevel).mockRejectedValueOnce(new Error('offline'))
  render(<VocabularyStartGate level="A1.2" lang="de" learnerId={learnerId}><p>Ready</p></VocabularyStartGate>)
  expect(await screen.findByRole('alert')).toHaveTextContent(t('error'))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: t('retry') })))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.queryByText('Ready')).not.toBeInTheDocument()
})

it('shows a per-origin distribution and changes the preference without touching word progress', async () => {
  render(<VocabularyCarryoverStation summary={summary} lang="de" learnerId={learnerId} />)
  expect(screen.getByRole('heading', { name: t('title') })).toBeInTheDocument()
  expect(screen.getByLabelText('Fach 3: 1 Wort')).toBeInTheDocument()
  expect(screen.getByText('A1.1')).toBeInTheDocument()
  const toggle = screen.getByRole('switch', { name: t('switch') })
  expect(toggle).toHaveAttribute('aria-checked', 'false')
  await act(async () => fireEvent.click(toggle))
  expect(toggle).toHaveAttribute('aria-checked', 'true')
  expect(refresh).toHaveBeenCalled()
  expect(announceVocabularyCarryoverChange).toHaveBeenCalledWith(learnerId)
  expect(beginVocabularyLevel).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(toggle))
  expect(setVocabularyCarryover).toHaveBeenLastCalledWith('A1.2', false, learnerId)
})

it('keeps the current-level percentage and separately labels included origins', () => {
  render(<LeitnerBoxOverview summary={{ ...summarizeBox([phase3]), percent: 0 }} level="A1.2" uiLanguage="de" translations={de.vocabulary} carryover={{ ...summary, enabled: true }} />)
  expect(screen.getByRole('progressbar', { name: de.vocabulary.box_progress_label })).toHaveAttribute('aria-valuenow', '0')
  expect(screen.getByText(t('separate', { count: 1 }))).toBeInTheDocument()
  expect(within(screen.getByRole('list', { name: t('title') })).getByText('A1.1')).toBeInTheDocument()
})

it.each(['de', 'en', 'ru', 'uk', 'tr'] as const)('provides every carryover message in %s without unresolved placeholders', lang => {
  expect(Object.keys(VOCABULARY_CARRYOVER_MESSAGES[lang])).toEqual(Object.keys(VOCABULARY_CARRYOVER_MESSAGES.de))
  for (const key of Object.keys(VOCABULARY_CARRYOVER_MESSAGES.de) as Array<keyof typeof VOCABULARY_CARRYOVER_MESSAGES.de>) {
    expect(carryoverTranslator(lang)(key, { count: 2, levels: 'A1.1', level: 'A1.1', phase: 3 })).not.toMatch(/\{\w+\}/)
  }
})
