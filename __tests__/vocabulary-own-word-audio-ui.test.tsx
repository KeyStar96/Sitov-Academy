import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LessonCardsModal from '@/components/vocabulary/LessonCardsModal'
import { addOwnWord, getLessonCards } from '@/app/actions/vocabulary'
import { VOCABULARY_FALLBACKS } from '@/lib/vocabulary-i18n'

jest.mock('@/app/actions/vocabulary', () => ({ addOwnWord: jest.fn(), getLessonCards: jest.fn(), addCardsToTrainer: jest.fn(), deleteOwnWord: jest.fn(), resetLessonProgress: jest.fn() }))
jest.unmock('lucide-react')

test('an audio preparation request keeps the word and translation for a later retry', async () => {
  jest.mocked(getLessonCards).mockResolvedValue([])
  jest.mocked(addOwnWord).mockResolvedValue({ success: false, error: 'audio_pending' })
  const changed = jest.fn()
  const user = userEvent.setup()
  render(<LessonCardsModal lesson="Eigene Wörter" level="A1.1" uiLanguage="ru" onClose={jest.fn()} onCardAdded={changed} />)
  const word = await screen.findByRole('textbox', { name: VOCABULARY_FALLBACKS.own_words_word_label })
  const translation = screen.getByRole('textbox', { name: VOCABULARY_FALLBACKS.own_words_translation_label })
  await user.type(word, 'das Brot')
  await user.type(translation, 'хлеб')
  await user.click(screen.getByRole('button', { name: VOCABULARY_FALLBACKS.own_words_add }))
  expect(await screen.findByText(VOCABULARY_FALLBACKS.own_words_audio_pending)).toHaveAttribute('role', 'status')
  expect(word).toHaveValue('das Brot')
  expect(translation).toHaveValue('хлеб')
  expect(changed).not.toHaveBeenCalled()
})
