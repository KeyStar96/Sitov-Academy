import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import LessonAssessmentClient from '@/app/[lang]/dashboard/level/[level]/vocabulary/assess/LessonAssessmentClient'
import { skipVocabularyAssessment, submitLessonAssessment } from '@/app/actions/vocabulary'
import { loadLernkastenSelection } from '@/lib/vocabulary-lernkasten'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'

jest.unmock('lucide-react')
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: mockReplace }) }))
jest.mock('@/app/actions/vocabulary', () => ({ submitLessonAssessment: jest.fn(), skipVocabularyAssessment: jest.fn() }))
jest.mock('@/components/layout/ThemeToggle', () => ({ __esModule: true, default: () => null }))
const cards = [{ id: 'word-1', article: 'das', word_de: 'Haus' }, { id: 'word-2', article: null, word_de: 'lernen' }]
function renderAssessment(locale = de.vocabulary, lang = 'de') {
  return render(<LessonAssessmentClient cards={cards} lessonName="Lektion 2" level="A1.1" lang={lang} translations={locale} />)
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
  expect(submitLessonAssessment).toHaveBeenCalledWith([{ cardId: 'word-1', alreadyKnown: false }])
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
  expect(skipVocabularyAssessment).toHaveBeenCalledWith('A1.1')
  expect(mockReplace).toHaveBeenCalledWith('/de/dashboard/level/A1.1/vocabulary/train?lesson=Lektion%201')
  expect(submitLessonAssessment).not.toHaveBeenCalled()
})
