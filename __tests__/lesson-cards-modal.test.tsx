import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import LessonCardsModal from '@/components/vocabulary/LessonCardsModal'
import { addCardsToTrainer, addOwnWord, deleteOwnWord, getLessonCards, resetLessonProgress } from '@/app/actions/vocabulary'
import { VOCABULARY_FALLBACKS } from '@/lib/vocabulary-i18n'
import type { AddCardsResult, LessonCardView } from '@/lib/types/vocabulary'

jest.unmock('lucide-react')

jest.mock('@/app/actions/vocabulary', () => ({
  addCardsToTrainer: jest.fn(), addOwnWord: jest.fn(), deleteOwnWord: jest.fn(), getLessonCards: jest.fn(), resetLessonProgress: jest.fn(),
}))

const card: LessonCardView = {
  id: 'word-1', word_de: 'Haus', article: 'das', plural: null, translation: 'house',
  image_url: null, audio_url: null, phase: null, isLearned: false,
}
const onClose = jest.fn()
const onCardAdded = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  jest.mocked(getLessonCards).mockResolvedValue([card])
  jest.mocked(resetLessonProgress).mockResolvedValue({ success: true })
})

it('shows manual additions immediately and restores the previous state after a failed save', async () => {
  let finish: (result: AddCardsResult) => void = () => undefined
  jest.mocked(addCardsToTrainer).mockReturnValue(new Promise(resolve => { finish = resolve }))
  render(<LessonCardsModal lesson="Lektion 1" level="A1.1" onClose={onClose} onCardAdded={onCardAdded} />)
  const add = await screen.findByRole('button', { name: /Haus.*Karteikasten/ })
  fireEvent.click(add)
  expect(screen.queryByRole('button', { name: /Haus.*Karteikasten/ })).not.toBeInTheDocument()
  expect(screen.getByText('Phase 1')).toBeInTheDocument()
  await act(async () => { finish({ success: false, added: 0 }) })
  expect(await screen.findByRole('button', { name: /Haus.*Karteikasten/ })).toBeInTheDocument()
  expect(screen.getByText(VOCABULARY_FALLBACKS.manual_add_failed)).toBeInTheDocument()
  expect(onCardAdded).not.toHaveBeenCalled()
})

it('switches tabs with arrow keys and keeps focus inside the modal', async () => {
  render(<LessonCardsModal lesson="Lektion 1" level="A1.1" onClose={onClose} onCardAdded={onCardAdded} />)
  const words = screen.getByRole('tab', { name: VOCABULARY_FALLBACKS.tab_words })
  words.focus()
  fireEvent.keyDown(words, { key: 'ArrowRight' })
  const phases = screen.getByRole('tab', { name: VOCABULARY_FALLBACKS.tab_phases })
  expect(phases).toHaveFocus()
  expect(phases).toHaveAttribute('aria-selected', 'true')
  await waitFor(() => expect(screen.queryByText(VOCABULARY_FALLBACKS.cards_loading)).not.toBeInTheDocument())
  const close = screen.getByRole('button', { name: VOCABULARY_FALLBACKS.close_cards })
  close.focus()
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
  expect(screen.getByRole('tabpanel')).toHaveFocus()
})

it('clears reset progress immediately and rolls it back if persistence fails', async () => {
  jest.mocked(getLessonCards).mockResolvedValue([{ ...card, phase: 3 }])
  let finish: (result: { success: boolean }) => void = () => undefined
  jest.mocked(resetLessonProgress).mockReturnValue(new Promise(resolve => { finish = resolve }))
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  render(<LessonCardsModal lesson="Lektion 1" level="A1.1" onClose={onClose} onCardAdded={onCardAdded} />)
  expect(await screen.findByText('Phase 3')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: VOCABULARY_FALLBACKS.reset_progress }))
  fireEvent.click(screen.getByRole('button', { name: VOCABULARY_FALLBACKS.reset_progress_yes }))
  expect(screen.queryByText('Phase 3')).not.toBeInTheDocument()
  await act(async () => { finish({ success: false }) })
  expect(screen.getByText('Phase 3')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent(VOCABULARY_FALLBACKS.error_description)
  expect(onCardAdded).not.toHaveBeenCalled()
})

it('requests lesson translations using the current interface language', async () => {
  render(<LessonCardsModal lesson="Lektion 1" level="A1.1" uiLanguage="uk" onClose={onClose} onCardAdded={onCardAdded} />)
  await screen.findByText('house')
  expect(getLessonCards).toHaveBeenCalledWith('Lektion 1', 'A1.1', 'uk')
})

describe('„Eigene Wörter"', () => {
  const own = 'Eigene Wörter'
  const word = (text: string) => screen.getByLabelText(VOCABULARY_FALLBACKS.own_words_word_label) as HTMLInputElement
  const translation = () => screen.getByLabelText(VOCABULARY_FALLBACKS.own_words_translation_label) as HTMLInputElement
  const submit = () => screen.getByRole('button', { name: VOCABULARY_FALLBACKS.own_words_add })

  it('Kurslektionen haben kein Eingabeformular mehr', async () => {
    render(<LessonCardsModal lesson="Lektion 1" level="A1.1" uiLanguage="ru" onClose={onClose} onCardAdded={onCardAdded} />)
    await screen.findByText('das Haus')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('trägt ein Wort ein, leert das Formular und lädt die Liste nach', async () => {
    jest.mocked(getLessonCards).mockResolvedValueOnce([]).mockResolvedValueOnce([{ ...card, id: 'own-1', word_de: 'Brot', translation: 'хлеб', phase: 1 }])
    jest.mocked(addOwnWord).mockResolvedValue({ success: true, cardId: 'own-1', activated: true })
    render(<LessonCardsModal lesson={own} level="A1.1" uiLanguage="ru" onClose={onClose} onCardAdded={onCardAdded} />)
    expect(screen.getByRole('dialog')).toHaveAccessibleName(VOCABULARY_FALLBACKS.own_words_title)
    expect(await screen.findByText(VOCABULARY_FALLBACKS.own_words_empty)).toBeInTheDocument()
    fireEvent.change(word(''), { target: { value: 'das Brot' } })
    fireEvent.change(translation(), { target: { value: 'хлеб' } })
    await act(async () => { fireEvent.click(submit()) })
    expect(addOwnWord).toHaveBeenCalledWith({ level: 'A1.1', word: 'das Brot', translation: 'хлеб', uiLanguage: 'ru' })
    expect(screen.getByRole('status')).toHaveTextContent(VOCABULARY_FALLBACKS.own_words_added_to_box.replace('{word}', 'das Brot'))
    expect(await screen.findByText('Phase 1')).toBeInTheDocument()
    expect(word('').value).toBe('')
    expect(translation().value).toBe('')
    expect(word('')).toHaveFocus()
    expect(onCardAdded).toHaveBeenCalledTimes(1)
  })

  it('verlangt beide Felder und meldet doppelte Wörter', async () => {
    jest.mocked(getLessonCards).mockResolvedValue([])
    jest.mocked(addOwnWord).mockResolvedValue({ success: false, error: 'exists' })
    render(<LessonCardsModal lesson={own} level="A1.1" uiLanguage="ru" onClose={onClose} onCardAdded={onCardAdded} />)
    await screen.findByText(VOCABULARY_FALLBACKS.own_words_empty)
    await act(async () => { fireEvent.click(submit()) })
    expect(screen.getByRole('alert')).toHaveTextContent(VOCABULARY_FALLBACKS.own_words_missing)
    expect(addOwnWord).not.toHaveBeenCalled()
    fireEvent.change(word(''), { target: { value: 'Brot' } })
    fireEvent.change(translation(), { target: { value: 'хлеб' } })
    await act(async () => { fireEvent.click(submit()) })
    expect(screen.getByRole('alert')).toHaveTextContent(VOCABULARY_FALLBACKS.own_words_exists)
    expect(word('').value).toBe('Brot')
    expect(onCardAdded).not.toHaveBeenCalled()
  })

  it('zeigt wartende Wörter ohne Einzel-Übernahme und löscht mit Rücknahme bei Fehlern', async () => {
    jest.mocked(getLessonCards).mockResolvedValue([card])
    jest.mocked(deleteOwnWord).mockResolvedValue({ success: false })
    render(<LessonCardsModal lesson={own} level="A1.1" uiLanguage="ru" onClose={onClose} onCardAdded={onCardAdded} />)
    expect(await screen.findByText(VOCABULARY_FALLBACKS.own_words_waiting)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Karteikasten/ })).not.toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: VOCABULARY_FALLBACKS.own_words_delete_aria.replace('{word}', 'das Haus') })) })
    expect(deleteOwnWord).toHaveBeenCalledWith('word-1')
    expect(screen.getByText('das Haus')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(VOCABULARY_FALLBACKS.own_words_delete_failed)
    expect(onCardAdded).not.toHaveBeenCalled()
  })
})
