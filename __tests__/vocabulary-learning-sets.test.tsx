import { fireEvent, render, screen } from '@testing-library/react'
import VocabTrainerPageClient from '@/components/vocabulary/VocabTrainerPageClient'
import { summarizeBox, type WordBoxState } from '@/lib/vocabulary-box'
import type { DueVocabularyCard } from '@/lib/types/vocabulary'
import de from '@/dictionaries/de.json'
import { studentTranslator } from '@/lib/student-ui-i18n'

jest.unmock('lucide-react')
jest.unmock('framer-motion')
jest.mock('@/app/actions/vocabulary', () => ({ getPhaseCards: jest.fn() }))
jest.mock('@/components/vocabulary/VocabCardSession', () => ({ __esModule: true, default: () => <p>session</p> }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }) }))

const learnerId = '00000000-0000-4000-8000-000000000001'
const s = studentTranslator('ru')

function card(lesson: string, progressId: string): DueVocabularyCard {
  return {
    progressId, box: 1, phase: 1, mode: 'learner_choice', promptLanguage: 'ru',
    direction: 'native_to_de', format: 'word', prompt: 'дом', contextSentence: null, solution: null,
    translation: 'дом', isHardForNativeLanguage: false,
    card: { id: progressId, word_de: 'Haus', article: 'das', plural: null, level: 'A1.1', lesson, image_url: null, audio_url: null },
  }
}

/** Ein Wort in Phase 2, das heute nicht fällig ist — die Box ist also nicht leer. */
const resting: WordBoxState = {
  phase: 2, isLearned: false, isHalfKnown: false, isDue: false, nextReviewDate: null,
  directions: {
    de_to_native: { phase: 2, isLearned: false, isDue: false, nextReviewDate: null },
    native_to_de: { phase: 2, isLearned: false, isDue: false, nextReviewDate: null },
  },
} as unknown as WordBoxState

function mount(cards: DueVocabularyCard[], box = summarizeBox([resting])) {
  return render(<VocabTrainerPageClient learnerId={learnerId} initialCards={cards} boxSummary={box}
    translations={de.vocabulary} lang="ru" level="A1.1" />)
}

it('zeigt nur noch die Lernbox: keine Lektionsliste, keine eigenen Wörter, keine Methoden-Erklärung', () => {
  mount([card('Lektion 1', 'p-1'), card('Lektion 1', 'p-2')])
  expect(screen.queryByRole('heading', { name: 'Lektion 1' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: de.vocabulary.own_words_title })).not.toBeInTheDocument()
  expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  expect(screen.queryByText(de.vocabulary.method_title)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Jetzt 2 Vokabeln üben' }))
  expect(screen.getByText('session')).toBeInTheDocument()
})

it('führt ohne fällige Karten zu den Lektionen', () => {
  mount([])
  expect(screen.getByText(de.vocabulary.lernkasten_all_done_hint)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: s('areas_to_lessons') })).toHaveAttribute('href', '/ru/dashboard/level/A1.1/vocabulary/lessons')
})

it('erklärt eine leere Lernbox und schickt zum Einschalten zu den Lektionen', () => {
  mount([], summarizeBox([]))
  expect(screen.getByRole('heading', { name: s('box_empty_title') })).toBeInTheDocument()
  expect(screen.getByText(s('box_empty_text'))).toBeInTheDocument()
  expect(screen.getByRole('link', { name: s('areas_to_lessons') })).toHaveAttribute('href', '/ru/dashboard/level/A1.1/vocabulary/lessons')
  expect(screen.queryByText(de.vocabulary.lernkasten_all_done_hint)).not.toBeInTheDocument()
})
