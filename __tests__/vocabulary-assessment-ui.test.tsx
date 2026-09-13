import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import LessonAssessmentClient, { type AssessmentCard } from '@/app/[lang]/dashboard/level/[level]/vocabulary/assess/LessonAssessmentClient'
import { skipVocabularyAssessment, submitLessonAssessment } from '@/app/actions/vocabulary'
import { loadLernkastenSelection } from '@/lib/vocabulary-lernkasten'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'

const learnerId = '00000000-0000-4000-8000-000000000001'
jest.unmock('lucide-react')
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: mockReplace }) }))
jest.mock('@/app/actions/vocabulary', () => ({ submitLessonAssessment: jest.fn(), skipVocabularyAssessment: jest.fn() }))
jest.mock('@/components/layout/ThemeToggle', () => ({ __esModule: true, default: () => null }))
const cards: AssessmentCard[] = [{ id: 'word-1', article: 'das', word_de: 'Haus', translation: 'house', translationLanguage: 'en', direction: 'de_to_native' }, { id: 'word-2', article: null, word_de: 'lernen', translation: 'learn', translationLanguage: 'en', direction: 'de_to_native' }]
function renderAssessment(locale = de.vocabulary, lang = 'de') {
  return render(<LessonAssessmentClient learnerId={learnerId} cards={cards} lessonName="Lektion 2" level="A1.1" lang={lang} translations={locale} />)
}
beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  jest.mocked(submitLessonAssessment).mockResolvedValue({ success: true, addedKnown: 0, addedNew: 1 })
})
it.each([['de', de], ['en', en], ['ru', ru], ['uk', uk], ['tr', tr]] as const)('shows only the target word and direct choices in %s', (lang, dict) => {
  renderAssessment(dict.vocabulary, lang)
  expect(screen.getByRole('heading', { name: 'das Haus' })).toBeVisible()
  expect(screen.queryByRole('button', { name: dict.vocabulary.reveal_solution })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: `${dict.vocabulary.already_know} ${dict.vocabulary.already_know_hint}` })).toBeVisible()
  expect(screen.getByRole('button', { name: `${dict.vocabulary.add_to_box} ${dict.vocabulary.add_to_box_hint}` })).toBeVisible()
})
it('stores an unknown word immediately, selects its lesson, and starts learning after assessment', async () => {
  renderAssessment()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Kenne ich nicht/ })))
  expect(submitLessonAssessment).toHaveBeenCalledWith([{ cardId: 'word-1', alreadyKnown: false, direction: 'de_to_native' }], learnerId)
  expect(loadLernkastenSelection('A1.1')).toEqual(['Lektion 2'])
  expect(screen.getByRole('heading', { name: 'lernen' })).toBeVisible()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Kenne ich bereits/ })))
  expect(mockReplace).toHaveBeenCalledWith('/de/dashboard/level/A1.1/vocabulary/train?lesson=Lektion%202')
})
it('restores the current word after a rejected save and does not select or navigate', async () => {
  jest.mocked(submitLessonAssessment).mockResolvedValue({ success: false, addedKnown: 0, addedNew: 0 })
  renderAssessment()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Kenne ich nicht/ })))
  expect(screen.getByRole('heading', { name: 'das Haus' })).toBeVisible()
  expect(screen.getByRole('status')).toHaveTextContent(de.vocabulary.assess_save_failed)
  expect(loadLernkastenSelection('A1.1')).toBeNull()
  expect(mockReplace).not.toHaveBeenCalled()
})
it('can skip an unfinished assessment directly to the first lesson returned by the server', async () => {
  jest.mocked(skipVocabularyAssessment).mockResolvedValue({ success: true, lesson: 'Lektion 1', added: 2 })
  renderAssessment()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: de.vocabulary.skip_assessment })))
  expect(skipVocabularyAssessment).toHaveBeenCalledWith('A1.1', learnerId)
  expect(mockReplace).toHaveBeenCalledWith('/de/dashboard/level/A1.1/vocabulary/train?lesson=Lektion%201')
  expect(submitLessonAssessment).not.toHaveBeenCalled()
})

function deferred<Result>() {
  let resolve!: (result: Result) => void
  const promise = new Promise<Result>(done => { resolve = done })
  return { promise, resolve }
}
it('accepts rapid assessment clicks without save labels and navigates only after both acknowledgements', async () => {
  const first = deferred<{ success: boolean; addedKnown: number; addedNew: number }>()
  const last = deferred<{ success: boolean; addedKnown: number; addedNew: number }>()
  jest.mocked(submitLessonAssessment).mockReturnValueOnce(first.promise).mockReturnValueOnce(last.promise)
  renderAssessment()
  fireEvent.click(screen.getByRole('button', { name: /Kenne ich nicht/ }))
  expect(screen.getByRole('heading', { name: 'lernen' })).toBeVisible()
  expect(screen.getByRole('button', { name: /Kenne ich bereits/ })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: /Kenne ich bereits/ }))
  expect(screen.getByText(de.vocabulary.assess_done_title)).toBeVisible()
  expect(screen.queryByText(de.vocabulary.saving_progress)).not.toBeInTheDocument()
  expect(screen.queryByText(de.vocabulary.assessment_auto_save)).not.toBeInTheDocument()
  expect(submitLessonAssessment).toHaveBeenCalledTimes(1)
  expect(mockReplace).not.toHaveBeenCalled()
  await act(async () => first.resolve({ success: true, addedKnown: 0, addedNew: 1 }))
  expect(submitLessonAssessment).toHaveBeenCalledTimes(2)
  expect(mockReplace).not.toHaveBeenCalled()
  await act(async () => last.resolve({ success: true, addedKnown: 1, addedNew: 0 }))
  expect(mockReplace).toHaveBeenCalledTimes(1)
})
it('keeps all rapid assessment decisions after an early failure and retries them in order', async () => {
  const first = deferred<{ success: boolean; addedKnown: number; addedNew: number }>()
  jest.mocked(submitLessonAssessment).mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce({ success: true, addedKnown: 0, addedNew: 1 }).mockResolvedValueOnce({ success: true, addedKnown: 1, addedNew: 0 })
  renderAssessment()
  fireEvent.click(screen.getByRole('button', { name: /Kenne ich nicht/ }))
  fireEvent.click(screen.getByRole('button', { name: /Kenne ich bereits/ }))
  await act(async () => first.resolve({ success: false, addedKnown: 0, addedNew: 0 }))
  expect(screen.getByRole('heading', { name: 'das Haus' })).toBeVisible()
  expect(loadLernkastenSelection('A1.1')).toBeNull()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: de.vocabulary.error_retry })))
  expect(jest.mocked(submitLessonAssessment).mock.calls.map(([decision]) => decision)).toEqual([
    [{ cardId: 'word-1', alreadyKnown: false, direction: 'de_to_native' }], [{ cardId: 'word-1', alreadyKnown: false, direction: 'de_to_native' }], [{ cardId: 'word-2', alreadyKnown: true, direction: 'de_to_native' }],
  ])
  expect(mockReplace).toHaveBeenCalledTimes(1)
})
it('queues skip behind pending decisions instead of dropping them', async () => {
  const first = deferred<{ success: boolean; addedKnown: number; addedNew: number }>()
  jest.mocked(submitLessonAssessment).mockReturnValueOnce(first.promise)
  jest.mocked(skipVocabularyAssessment).mockResolvedValueOnce({ success: true, lesson: 'Lektion 1', added: 1 })
  renderAssessment()
  fireEvent.click(screen.getByRole('button', { name: /Kenne ich nicht/ }))
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.skip_assessment }))
  expect(skipVocabularyAssessment).not.toHaveBeenCalled()
  await act(async () => first.resolve({ success: true, addedKnown: 0, addedNew: 1 }))
  expect(skipVocabularyAssessment).toHaveBeenCalledTimes(1)
  expect(mockReplace).toHaveBeenCalledWith('/de/dashboard/level/A1.1/vocabulary/train?lesson=Lektion%201')
})
it('never rebinds buffered assessment choices to a different incoming learner', async () => {
  const first = deferred<{ success: boolean; addedKnown: number; addedNew: number }>()
  jest.mocked(submitLessonAssessment).mockReturnValueOnce(first.promise).mockResolvedValueOnce({ success: true, addedKnown: 1, addedNew: 0 })
  const { rerender } = renderAssessment()
  fireEvent.click(screen.getByRole('button', { name: /Kenne ich nicht/ }))
  rerender(<LessonAssessmentClient learnerId="00000000-0000-4000-8000-000000000002" cards={cards} lessonName="Lektion 2" level="A1.1" lang="de" translations={de.vocabulary} />)
  fireEvent.click(screen.getByRole('button', { name: /Kenne ich bereits/ }))
  await act(async () => first.resolve({ success: true, addedKnown: 0, addedNew: 1 }))
  expect(jest.mocked(submitLessonAssessment).mock.calls.map(([, actor]) => actor)).toEqual([learnerId, learnerId])
})

it('flushes rapid decisions and starts learning when the browser blocks the storage getter', async () => {
  const first = deferred<{ success: boolean; addedKnown: number; addedNew: number }>()
  jest.mocked(submitLessonAssessment).mockReturnValueOnce(first.promise)
  const storage = jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('Storage is blocked', 'SecurityError')
  })
  try {
    renderAssessment()
    fireEvent.click(screen.getByRole('button', { name: /Kenne ich nicht/ }))
    fireEvent.click(screen.getByRole('button', { name: /Kenne ich bereits/ }))
    await act(async () => first.resolve({ success: true, addedKnown: 0, addedNew: 1 }))
    expect(jest.mocked(submitLessonAssessment).mock.calls.map(([decision]) => decision)).toEqual([
      [{ cardId: 'word-1', alreadyKnown: false, direction: 'de_to_native' }], [{ cardId: 'word-2', alreadyKnown: true, direction: 'de_to_native' }],
    ])
    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith('/de/dashboard/level/A1.1/vocabulary/train?lesson=Lektion%202')
    expect(screen.queryByText(de.vocabulary.assess_save_failed)).not.toBeInTheDocument()
  } finally {
    storage.mockRestore()
  }
})

it('assesses both directions in separate passes and saves each answer independently', async () => {
  const both: AssessmentCard[] = cards.flatMap(card => [card, { ...card, direction: 'native_to_de' }])
  render(<LessonAssessmentClient learnerId={learnerId} cards={both} lessonName="Lektion 2" level="A1.1" lang="en" translations={de.vocabulary} />)
  expect(screen.getByRole('heading', { name: 'das Haus' })).toHaveAttribute('lang', 'de')
  fireEvent.click(screen.getByRole('button', { name: /Kenne ich bereits/ }))
  expect(screen.getByRole('heading', { name: 'lernen' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /Kenne ich bereits/ }))
  expect(screen.getByRole('heading', { name: 'house' })).toHaveAttribute('lang', 'en')
  expect(screen.getByText(de.vocabulary.direction_to_de)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /Kenne ich nicht/ }))
  expect(screen.getByRole('heading', { name: 'learn' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /Kenne ich bereits/ }))
  await act(async () => undefined)
  expect(jest.mocked(submitLessonAssessment).mock.calls.map(([decisions]) => decisions[0])).toEqual([
    { cardId: 'word-1', alreadyKnown: true, direction: 'de_to_native' },
    { cardId: 'word-2', alreadyKnown: true, direction: 'de_to_native' },
    { cardId: 'word-1', alreadyKnown: false, direction: 'native_to_de' },
    { cardId: 'word-2', alreadyKnown: true, direction: 'native_to_de' },
  ])
})

it('resumes only the missing assessment direction after a partial earlier assessment', async () => {
  render(<LessonAssessmentClient learnerId={learnerId} cards={[{ ...cards[0], direction: 'native_to_de' }]} lessonName="Lektion 2" level="A1.1" lang="en" translations={de.vocabulary} />)
  expect(screen.getByRole('heading', { name: 'house' })).toBeVisible()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Kenne ich nicht/ })))
  expect(submitLessonAssessment).toHaveBeenCalledWith([{ cardId: 'word-1', alreadyKnown: false, direction: 'native_to_de' }], learnerId)
  expect(submitLessonAssessment).toHaveBeenCalledTimes(1)
})
