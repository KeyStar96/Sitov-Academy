import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LessonAssessmentClient from '@/app/[lang]/dashboard/level/[level]/vocabulary/assess/LessonAssessmentClient'
import { submitLessonAssessment } from '@/app/actions/vocabulary'
import { VOCABULARY_FALLBACKS } from '@/lib/vocabulary-i18n'
import type { LessonCardView } from '@/lib/types/vocabulary'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'

const learnerId = '00000000-0000-4000-8000-000000000001'
jest.unmock('lucide-react')
jest.mock('@/app/actions/vocabulary', () => ({
  submitLessonAssessment: jest.fn(),
  skipVocabularyAssessment: jest.fn(),
}))
jest.mock('@/components/exercises/SolutionAudioButton', () => ({
  __esModule: true,
  default: ({ label }: { label: string }) => React.createElement('button', { type: 'button' }, label),
}))

const translations = de.vocabulary
const house: LessonCardView = {
  id: 'card-house',
  word_de: 'Haus',
  article: 'das',
  plural: 'Häuser',
  translation: 'дом',
  image_url: null,
  audio_url: null,
  phase: null,
  isLearned: false,
}
const tree: LessonCardView = {
  id: 'card-tree',
  word_de: 'Baum',
  article: 'der',
  plural: 'Bäume',
  translation: 'дерево',
  image_url: null,
  audio_url: null,
  phase: null,
  isLearned: false,
}

function renderAssess(cards: LessonCardView[] = [house, tree]) {
  return render(
    <LessonAssessmentClient
      learnerId={learnerId}
      cards={cards.map(card => ({ ...card, direction: 'de_to_native', translationLanguage: 'ru' }))}
      lessonName="Lektion 1"
      lang="ru"
      level="A1.1"
      translations={translations}
    />
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(submitLessonAssessment).mockResolvedValue({ success: true, addedKnown: 1, addedNew: 0 })
})

it.each([
  ['de', de],
  ['en', en],
  ['ru', ru],
  ['uk', uk],
  ['tr', tr],
] as const)('alle Einstufungs-Texte existieren für %s', (_lang, dict) => {
  for (const key of Object.keys(VOCABULARY_FALLBACKS) as Array<keyof typeof VOCABULARY_FALLBACKS>) {
    expect(dict.vocabulary[key]).toEqual(expect.any(String))
    expect(dict.vocabulary[key].length).toBeGreaterThan(0)
  }
})

it('shows the interface word, then German article and plural before the phase decision', async () => {
  renderAssess()
  expect(screen.getByText('дом')).toBeInTheDocument()
  expect(screen.queryByText('das Haus')).not.toBeInTheDocument()
  expect(screen.queryByText(translations.already_know)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: translations.reveal_solution }))
  expect(screen.getByText('das Haus')).toBeInTheDocument()
  expect(screen.getByText(translations.plural_label.replace('{plural}', 'Häuser'))).toBeInTheDocument()
  fireEvent.click(screen.getByText(translations.already_know))
  await waitFor(() => expect(submitLessonAssessment).toHaveBeenCalledWith([{ cardId: 'card-house', alreadyKnown: true }], learnerId))
  expect(screen.getByText('дерево')).toBeInTheDocument()
  expect(screen.queryByText('der Baum')).not.toBeInTheDocument()
})

it('adds unknown words only after revealing the translation', async () => {
  renderAssess()
  fireEvent.click(screen.getByRole('button', { name: translations.reveal_solution }))
  fireEvent.click(screen.getByText(translations.add_to_box))
  await waitFor(() => expect(submitLessonAssessment).toHaveBeenCalledWith([{ cardId: 'card-house', alreadyKnown: false }], learnerId))
})

it('ordnet die Entscheidung wie beim Lernen an: links „weiß ich", rechts „weiß ich nicht"', () => {
  renderAssess()
  fireEvent.click(screen.getByRole('button', { name: translations.reveal_solution }))
  const known = screen.getByText(translations.already_know).closest('button')!
  const unknown = screen.getByText(translations.add_to_box).closest('button')!
  expect(known.compareDocumentPosition(unknown) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(known).toHaveClass('learning-button-primary')
})
