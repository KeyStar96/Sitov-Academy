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
      cards={cards}
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

it('zeigt nur das Lernwort und beide Entscheidungen ohne Lösungsschritt', () => {
  renderAssess()
  expect(screen.queryByText('дом')).not.toBeInTheDocument()
  expect(screen.getByText('das Haus')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: translations.reveal_solution })).not.toBeInTheDocument()
  expect(screen.getByText(translations.already_know)).toBeInTheDocument()
  expect(screen.getByText(translations.add_to_box)).toBeInTheDocument()
})

it('lässt unmittelbar über Stufe 1 oder Stufe 6 entscheiden', async () => {
  renderAssess()

  expect(screen.getByText('das Haus')).toBeInTheDocument()
  expect(screen.queryByText(translations.plural_label.replace('{plural}', 'Häuser'))).not.toBeInTheDocument()
  expect(screen.getByText(translations.already_know)).toBeInTheDocument()
  expect(screen.getByText(translations.add_to_box)).toBeInTheDocument()

  fireEvent.click(screen.getByText(translations.already_know))
  await waitFor(() => {
    expect(submitLessonAssessment).toHaveBeenCalledWith([{ cardId: 'card-house', alreadyKnown: true }])
  })
})

it('nimmt unbekannte Wörter ohne Aufdecken in den Lernkasten auf', async () => {
  jest.mocked(submitLessonAssessment).mockResolvedValue({ success: true, addedKnown: 0, addedNew: 1 })
  renderAssess()
  fireEvent.click(screen.getByText(translations.add_to_box))
  await waitFor(() => {
    expect(submitLessonAssessment).toHaveBeenCalledWith([{ cardId: 'card-house', alreadyKnown: false }])
  })
})
