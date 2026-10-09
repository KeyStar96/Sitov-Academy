import { fireEvent, render, screen } from '@testing-library/react'
import VocabularyLessons from '@/components/vocabulary/VocabularyLessons'
import LessonCardsModal from '@/components/vocabulary/LessonCardsModal'
import VocabularyLessonsPage from '@/app/[lang]/dashboard/level/[level]/vocabulary/lessons/page'
import { addOwnWord, getLessonCards } from '@/app/actions/vocabulary'
import { loadLevelLearningStatus } from '@/lib/learning-status-server'
import { resolveSitovVocabularyTarget } from '@/lib/learning/sitov-learning-target-server'
import { OWN_WORDS_LESSON } from '@/lib/vocabulary-own-words'
import type { LessonStation } from '@/lib/learning-status-server'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
jest.mock('@/app/actions/vocabulary', () => ({ addOwnWord: jest.fn(), getLessonCards: jest.fn(), addCardsToTrainer: jest.fn(), deleteOwnWord: jest.fn(), resetLessonProgress: jest.fn(), initializeLesson: jest.fn(), setLessonInBox: jest.fn() }))
jest.mock('@/lib/learning/sitov-learning-target-server', () => ({ resolveSitovVocabularyTarget: jest.fn() }))
jest.mock('@/lib/request-session', () => ({ requestSession: jest.fn(async () => ({ supabase: {}, user: { id: 'learner' } })) }))
jest.mock('@/lib/access/server', () => ({ loadLevelAccessProfile: jest.fn(async () => null) }))
jest.mock('@/lib/dictionary', () => ({ getDictionary: jest.fn(async () => de) }))
jest.mock('@/lib/learning-status-server', () => ({ loadLevelLearningStatus: jest.fn() }))
jest.mock('@/lib/learning-new-server', () => ({ loadLearningNewItems: jest.fn(async () => ({ items: {}, lessonIds: {} })) }))

const own: LessonStation = { lesson: OWN_WORDS_LESSON, total: 0, active: 0, learned: 0, untouched: 0, due: 0 }
const phrase = 'Könnten Sie mir bitte helfen?'
const example = 'Könnten Sie mir bitte mit dem Formular helfen?'

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getLessonCards).mockResolvedValue([])
  // These fixtures exercise ordinary own-word queries, with no recommendation target.
  jest.mocked(resolveSitovVocabularyTarget).mockReset().mockImplementation(async raw => {
    if (raw !== undefined) throw new Error('Unexpected recommendation target in own-word fixture')
    return null
  })
})

it('opens the private lesson with a prepared phrase and waits for an explicit submit', async () => {
  render(<VocabularyLessons lang="de" level="B1.2" stations={[]} next={null} vocabularyHref="/de/dashboard/level/B1.2/vocabulary"
    vocabularyTranslations={de.vocabulary} ownWords={own} initialOwnWord={phrase} initialOwnExample={example} />)
  const field = await screen.findByRole('textbox', { name: de.vocabulary.own_words_word_label })
  expect(field).toHaveValue(phrase)
  expect(screen.getByText(example)).toHaveAttribute('lang', 'de')
  expect(getLessonCards).toHaveBeenCalledWith(OWN_WORDS_LESSON, 'B1.2', 'de')
  expect(addOwnWord).not.toHaveBeenCalled()
  fireEvent.change(screen.getByRole('textbox', { name: de.vocabulary.own_words_translation_label }), { target: { value: 'Could you please help me?' } })
  expect(addOwnWord).not.toHaveBeenCalled()
})

it('does not open or write a private lesson when the level has no own-word lesson', () => {
  render(<VocabularyLessons lang="de" level="B1.2" stations={[]} next={null} vocabularyHref={null}
    vocabularyTranslations={de.vocabulary} initialOwnWord={phrase} initialOwnExample={example} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(addOwnWord).not.toHaveBeenCalled()
})

it('does not prefill or expose the personal example in a course lesson', async () => {
  render(<LessonCardsModal lesson="Lektion 1 · Beruf und Arbeit" level="A1.2" uiLanguage="de" translations={de.vocabulary}
    initialOwnWord={phrase} initialOwnExample={example} onClose={jest.fn()} onCardAdded={jest.fn()} />)
  await screen.findByText('Hier gibt es noch keine Karten dieser Art.')
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByText(phrase)).not.toBeInTheDocument()
  expect(screen.queryByText(example)).not.toBeInTheDocument()
  expect(addOwnWord).not.toHaveBeenCalled()
})

it('keeps a prepared phrase and manual translation when audio preparation is pending', async () => {
  jest.mocked(addOwnWord).mockResolvedValue({ success: false, error: 'audio_pending' })
  const changed = jest.fn()
  render(<LessonCardsModal lesson={OWN_WORDS_LESSON} level="B1.2" uiLanguage="de" translations={de.vocabulary}
    initialOwnWord={phrase} initialOwnExample={example} onClose={jest.fn()} onCardAdded={changed} />)
  const word = await screen.findByRole('textbox', { name: de.vocabulary.own_words_word_label })
  const translation = screen.getByRole('textbox', { name: de.vocabulary.own_words_translation_label })
  fireEvent.change(translation, { target: { value: 'Could you please help me?' } })
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.own_words_add }))
  expect(await screen.findByText(de.vocabulary.own_words_audio_pending)).toHaveAttribute('role', 'status')
  expect(word).toHaveValue(phrase)
  expect(translation).toHaveValue('Could you please help me?')
  expect(addOwnWord).toHaveBeenCalledTimes(1)
  expect(addOwnWord).toHaveBeenCalledWith({ level: 'B1.2', word: phrase, translation: 'Could you please help me?', uiLanguage: 'de' })
  expect(changed).not.toHaveBeenCalled()
})

it.each([
  { sitovWord: ['first', 'second'], sitovExample: ['one', 'two'] },
  { sitovWord: 'x'.repeat(161), sitovExample: 'x'.repeat(1001) },
])('rejects malformed or overlong query prefill without saving', async query => {
  jest.mocked(loadLevelLearningStatus).mockResolvedValue({ level: 'B1.2', lessons: [], ownWords: own, vocabulary: { locked: false, total: 0, due: 0, activeWords: 0, learned: 0 } } as Awaited<ReturnType<typeof loadLevelLearningStatus>>)
  const page = await VocabularyLessonsPage({ params: Promise.resolve({ lang: 'de', level: 'B1.2' }), searchParams: Promise.resolve(query) })
  expect(resolveSitovVocabularyTarget).toHaveBeenCalledWith(undefined, 'B1.2', expect.objectContaining({ user: { id: 'learner' } }), null)
  expect(page.props.sitovTarget).toBeNull()
  expect(page.props.initialOwnWord).toBe('')
  expect(page.props.initialOwnExample).toBe('')
  expect(addOwnWord).not.toHaveBeenCalled()
})


it('passes trimmed ordinary query prefill to the private form without automatically writing', async () => {
  jest.mocked(loadLevelLearningStatus).mockResolvedValue({ level: 'B1.2', lessons: [], ownWords: own,
    vocabulary: { locked: false, total: 0, due: 0, activeWords: 0, learned: 0 } } as Awaited<ReturnType<typeof loadLevelLearningStatus>>)
  const page = await VocabularyLessonsPage({ params: Promise.resolve({ lang: 'de', level: 'B1.2' }),
    searchParams: Promise.resolve({ sitovWord: `  ${phrase}  `, sitovExample: `  ${example}  ` }) })
  expect(resolveSitovVocabularyTarget).toHaveBeenCalledWith(undefined, 'B1.2', expect.objectContaining({ user: { id: 'learner' } }), null)
  expect(page.props.sitovTarget).toBeNull()
  expect(page.props.initialOwnWord).toBe(phrase)
  expect(page.props.initialOwnExample).toBe(example)
  render(page)
  expect(await screen.findByRole('textbox', { name: de.vocabulary.own_words_word_label })).toHaveValue(phrase)
  expect(screen.getByText(example)).toHaveAttribute('lang', 'de')
  expect(addOwnWord).not.toHaveBeenCalled()
})
