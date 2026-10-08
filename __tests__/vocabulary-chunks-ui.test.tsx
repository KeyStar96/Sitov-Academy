import { saveStudyMode } from '@/lib/vocabulary-lernkasten'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import LessonCardsModal from '@/components/vocabulary/LessonCardsModal'
import VocabCardSession from '@/components/vocabulary/VocabCardSession'
import { SitovVocabularyUsage } from '@/components/vocabulary/SitovVocabularyContent'
import SolutionAudioButton from '@/components/exercises/SolutionAudioButton'
import { getLessonCards } from '@/app/actions/vocabulary'
import { prefetchNeuralAudio } from '@/lib/audio/neural-client'
import { sitovFilterVocabularyCards, sitovVocabularyCardKind, sitovVocabularyKindCounts } from '@/lib/vocabulary-chunks'
import { SITOV_VOCABULARY_CHUNKS_MESSAGES } from '@/lib/vocabulary-chunks-i18n'
import type { DueVocabularyCard, LessonCardView } from '@/lib/types/vocabulary'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
jest.mock('@/app/actions/vocabulary', () => ({
  getLessonCards: jest.fn(), addCardsToTrainer: jest.fn(), addOwnWord: jest.fn(), deleteOwnWord: jest.fn(), resetLessonProgress: jest.fn(),
  submitVocabularyAnswer: jest.fn(), submitVocabularySelfRating: jest.fn(), checkVocabularyRetry: jest.fn(), finishVocabularySession: jest.fn(),
}))
jest.mock('@/app/actions/learning-checkpoints', () => ({
  saveLearningCheckpoint: jest.fn(async (_kind, _level, state, revision) => ({ ok: true, learnerId: 'learner', checkpoint: { state, revision: revision + 1, updatedAt: '2026-10-03T09:00:00Z' } })),
  clearLearningCheckpoint: jest.fn(),
}))
jest.mock('@/components/layout/ThemeToggle', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/exercises/SolutionAudioButton', () => ({ __esModule: true, default: jest.fn(({ label, text, cardId }: { label: string; text: string; cardId?: string }) => <button data-audio-text={text} data-audio-card={cardId}>{label}</button>) }))
jest.mock('@/lib/audio/neural-client', () => ({ prefetchNeuralAudio: jest.fn().mockReturnValue(jest.fn()) }))

const word: LessonCardView = {
  id: 'word', word_de: 'Termin', article: 'der', plural: 'Termine', translation: 'appointment',
  image_url: null, audio_url: null, phase: 1, isLearned: false, contentKind: 'vocabulary',
  usageChunk: 'einen Termin vereinbaren', usageChunkTranslation: 'make an appointment',
  contextSentence: 'Paul vereinbart einen Termin.', exampleTranslation: 'Paul makes an appointment.',
}
const chunk: LessonCardView = {
  ...word, id: 'chunk', word_de: 'Könnten Sie mir bitte helfen?', article: null, contentKind: 'chunk',
  usageChunk: 'Könnten Sie mir bitte helfen?', translation: 'Could you please help me?', contextSentence: 'Könnten Sie mir bitte mit dem Formular helfen?',
}

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  jest.mocked(getLessonCards).mockResolvedValue([word, chunk])
})

it('counts only explicit chunk cards and treats existing word cards as words', () => {
  const cards = [word, chunk, { ...word, id: 'legacy', contentKind: undefined }]
  expect(sitovVocabularyCardKind(cards[2])).toBe('vocabulary')
  expect(sitovVocabularyKindCounts(cards)).toEqual({ all: 3, vocabulary: 2, chunk: 1 })
  expect(sitovFilterVocabularyCards(cards, 'chunk')).toEqual([chunk])
})

it('lets learners browse words and chunks without counting attached usage twice', async () => {
  render(<LessonCardsModal lesson="Lektion 1" level="A2.1" uiLanguage="de" onClose={jest.fn()} onCardAdded={jest.fn()} />)
  const picker = await screen.findByRole('radiogroup', { name: 'Kartenart auswählen' })
  expect(within(picker).getByRole('radio', { name: 'Alle 2' })).toHaveAttribute('aria-checked', 'true')
  expect(within(picker).getByRole('radio', { name: 'Wörter 1' })).toBeInTheDocument()
  fireEvent.click(within(picker).getByRole('radio', { name: 'Chunks 1' }))
  expect(screen.getByText(chunk.word_de)).toBeInTheDocument()
  expect(screen.queryByText('der Termin')).not.toBeInTheDocument()
  // Filtering does not mutate the server-backed lesson or its progress.
  expect(getLessonCards).toHaveBeenCalledTimes(1)
  fireEvent.keyDown(within(picker).getByRole('radio', { name: 'Chunks 1' }), { key: 'ArrowLeft' })
  expect(within(picker).getByRole('radio', { name: 'Wörter 1' })).toHaveFocus()
  expect(screen.getByText('der Termin')).toBeInTheDocument()
  expect(screen.queryByText(chunk.word_de)).not.toBeInTheDocument()
})

it('keeps an embedded chunk and its translated example on the same card', () => {
  render(<SitovVocabularyUsage word="der Termin" usageChunk={word.usageChunk} usageChunkTranslation={word.usageChunkTranslation}
    example={word.contextSentence} exampleTranslation={word.exampleTranslation} lang="en" />)
  expect(screen.getByText('einen Termin vereinbaren')).toBeInTheDocument()
  expect(screen.getByText('make an appointment')).toBeInTheDocument()
  expect(screen.queryByText('Paul vereinbart einen Termin.')).not.toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Word combination' }), { key: 'ArrowRight' })
  expect(screen.getByRole('tab', { name: 'Example' })).toHaveFocus()
  expect(screen.getByText('Paul vereinbart einen Termin.')).toHaveAttribute('lang', 'de')
  expect(screen.getByText('Paul makes an appointment.')).toHaveAttribute('lang', 'en')
})

it('shows a standalone chunk example without duplicating its headword', () => {
  render(<SitovVocabularyUsage word={chunk.word_de} usageChunk={chunk.usageChunk} example={chunk.contextSentence} lang="de" />)
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  expect(screen.queryByText(chunk.word_de)).not.toBeInTheDocument()
  expect(screen.getByText(chunk.contextSentence!)).toBeInTheDocument()
})

function session(cardOverrides: Partial<DueVocabularyCard['card']> = {}) {
  const card: DueVocabularyCard = {
    progressId: 'progress-1', box: 3, phase: 3, mode: 'learner_choice', promptLanguage: 'en',
    direction: 'native_to_de', format: 'word', prompt: 'appointment', contextSentence: word.contextSentence!, solution: null,
    translation: word.translation, isHardForNativeLanguage: false,
    card: { ...word, level: 'A2.1', lesson: 'Lektion 1', ...cardOverrides },
  }
  return render(<VocabCardSession learnerId="learner" cards={[card]} translations={de.vocabulary} uiLanguage="de" overviewHref="/de/dashboard" />)
}

it('reveals German usage only after turning the card and does not turn it when changing usage tabs', () => {
  const view = session()
  expect(screen.queryByText('einen Termin vereinbaren')).not.toBeInTheDocument()
  expect(screen.queryByText('Paul vereinbart einen Termin.')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))
  expect(screen.getByText('einen Termin vereinbaren')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Anhören' })).toHaveAttribute('data-audio-text', 'einen Termin vereinbaren')
  expect(screen.getByRole('button', { name: 'Anhören' })).toHaveAttribute('data-audio-card', 'word')
  fireEvent.click(screen.getByRole('tab', { name: 'Beispiel' }))
  expect(screen.getByText('Paul vereinbart einen Termin.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Anhören' })).toHaveAttribute('data-audio-text', 'Paul vereinbart einen Termin.')
  expect(view.container.querySelector('.learning-card-flip')).toHaveClass('is-revealed')
  expect(view.container.querySelector('.learning-flip-front')).toHaveAttribute('inert')
  expect(view.container.querySelector('.learning-flip-front')).toHaveAttribute('aria-hidden', 'true')
  // Turning back removes German usage and its audio controls from the DOM,
  // rather than leaving a hidden answer reachable by assistive technology.
  fireEvent.click(screen.getByText('der Termin'))
  expect(view.container.querySelector('.learning-flip-back')).toHaveAttribute('inert')
  expect(view.container.querySelector('.learning-flip-back')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.queryByText('Paul vereinbart einen Termin.')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Anhören' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))
  expect(screen.getByRole('tab', { name: 'Wortverbindung' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('button', { name: 'Anhören' })).toHaveAttribute('data-audio-text', 'einen Termin vereinbaren')
})

it('does not expose German usage when switching to a typed prompt', () => {
  session({ contentKind: 'chunk' })
  act(() => saveStudyMode('typed'))
  expect(screen.getByRole('textbox')).toBeInTheDocument()
  expect(screen.queryByText('einen Termin vereinbaren')).not.toBeInTheDocument()
  expect(screen.queryByText('Paul vereinbart einen Termin.')).not.toBeInTheDocument()
  expect(screen.getByText('Chunk')).toBeInTheDocument()
})

it('passes each revealed usage text with its card scope and never prefetches hidden usage', () => {
  const cardId = 'fc5ff112-e442-4e86-a4f9-bda38f09089f'
  const headwordAudio = '/prepared/termin.mp3'
  session({ id: cardId, audio_url: headwordAudio })
  // The existing lookahead loads the headword only. Neither German usage text
  // reaches the shared player or the prefetch queue before the learner reveals it.
  expect(SolutionAudioButton).not.toHaveBeenCalled()
  expect(prefetchNeuralAudio).toHaveBeenCalledWith([
    { text: 'der Termin', language: 'de', cardId, audioUrl: headwordAudio },
  ])
  const lookaheadCalls = jest.mocked(prefetchNeuralAudio).mock.calls.length

  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))
  const usageSources = () => jest.mocked(SolutionAudioButton).mock.calls
    .map(([props]) => props).filter(props => props.label === 'Anhören')
  expect(usageSources()).toEqual([
    expect.objectContaining({ text: word.usageChunk, cardId, language: 'de', level: 'A2.1' }),
  ])
  // A chunk/example must resolve its own prepared recording, rather than
  // accidentally inheriting the headword's explicit recording URL.
  expect(usageSources()[0].audioUrl).toBeUndefined()
  expect(usageSources().some(props => props.text === word.contextSentence)).toBe(false)

  fireEvent.click(screen.getByRole('tab', { name: 'Beispiel' }))
  expect(usageSources().at(-1)).toEqual(expect.objectContaining({
    text: word.contextSentence, cardId, language: 'de', level: 'A2.1',
  }))
  expect(usageSources().at(-1)?.audioUrl).toBeUndefined()
  expect(prefetchNeuralAudio).toHaveBeenCalledTimes(lookaheadCalls)
})

it('provides the chunk distinction in every supported UI language', () => {
  for (const messages of Object.values(SITOV_VOCABULARY_CHUNKS_MESSAGES)) {
    expect(messages.chunk_explanation.length).toBeGreaterThan(20)
    expect(messages.words).not.toBe(messages.chunks)
  }
})
