jest.mock('@/app/actions/learning-checkpoints', () => ({
  loadLearningCheckpoint: jest.fn().mockResolvedValue({ ok: true, learnerId: '00000000-0000-4000-8000-000000000001', checkpoint: null }),
  saveLearningCheckpoint: jest.fn(async (_kind, _level, state, revision) => ({ ok: true, learnerId: '00000000-0000-4000-8000-000000000001', checkpoint: { state, revision: revision + 1, updatedAt: '2026-10-03T09:00:00Z' } })),
  clearLearningCheckpoint: jest.fn(async (_kind, _level, revision) => ({ ok: true, learnerId: '00000000-0000-4000-8000-000000000001', checkpoint: { state: {}, revision: revision + 1, updatedAt: '2026-10-03T09:00:00Z' } })),
}))
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import VocabCardSession from '@/components/vocabulary/VocabCardSession'
import { generateAudio } from '@/app/actions/generate-audio'
import type { DueVocabularyCard } from '@/lib/types/vocabulary'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
jest.mock('@/app/actions/vocabulary', () => ({
  submitVocabularyAnswer: jest.fn(), submitVocabularySelfRating: jest.fn(),
  checkVocabularyRetry: jest.fn(), finishVocabularySession: jest.fn(),
}))
jest.mock('@/app/actions/generate-audio', () => ({ generateAudio: jest.fn() }))
jest.mock('@/components/layout/ThemeToggle', () => ({ __esModule: true, default: () => null }))

const word: DueVocabularyCard = {
  progressId: 'progress-audio', box: 1, phase: 1, mode: 'flashcard', promptLanguage: 'en',
  direction: 'native_to_de', format: 'word', prompt: 'house', contextSentence: null,
  solution: null, translation: 'house', isHardForNativeLanguage: false,
  card: { id: 'audio-word', word_de: 'Haus', article: 'das', plural: 'Häuser', level: 'A1.1',
    lesson: 'Lektion 1', image_url: null, audio_url: 'https://media.example.invalid/haus.mp3' },
}

beforeEach(() => {
  localStorage.clear()
  jest.clearAllMocks()
  jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined)
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function () {
    this.dispatchEvent(new Event('play'))
    this.dispatchEvent(new Event('playing'))
    return Promise.resolve()
  })
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function () {
    this.dispatchEvent(new Event('pause'))
  })
})
afterEach(() => jest.restoreAllMocks())

function mount() {
  const result = render(<VocabCardSession learnerId="00000000-0000-4000-8000-000000000001"
    cards={[word]} translations={de.vocabulary} uiLanguage="en" overviewHref="/en/dashboard" />)
  const card = result.container.querySelector('.learning-card-flip')!
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))
  return { ...result, card }
}

function touchTap(target: Element) {
  fireEvent.pointerDown(target, { pointerType: 'touch', pointerId: 1 })
  fireEvent.touchStart(target)
  fireEvent.pointerUp(target, { pointerType: 'touch', pointerId: 1 })
  fireEvent.touchEnd(target)
  fireEvent.click(target, { detail: 1 })
}

// JSDOM has no native PointerEvent constructor; populate the browser fields
// explicitly so these tests exercise travel, cancellation and scrollbar hits.
function cardPointer(target: Element, type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel', values: Partial<PointerEvent> = {}) {
  const event = new Event(type, { bubbles: true })
  Object.assign(event, { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: 150, clientY: 100, ...values })
  fireEvent(target, event)
}

it.each(['button', 'text', 'svg'] as const)('plays once from a touch tap on the pronunciation %s without flipping the card', async target => {
  const { card } = mount()
  const button = screen.getByRole('button', { name: /Haus.*anhören/ })
  const tapped = target === 'button' ? button : target === 'text' ? button.querySelector('span')! : button.querySelector('svg path')!
  touchTap(tapped)
  expect(card).toHaveClass('is-revealed')
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
  expect(generateAudio).not.toHaveBeenCalled()
  await act(async () => undefined)
})

it('keeps speed labels, audio-area gaps and native select defaults separate from card taps', () => {
  const { card, container } = mount()
  const label = screen.getByText(de.neural_audio.speed)
  touchTap(label)
  expect(card).toHaveClass('is-revealed')
  const select = screen.getByRole('combobox', { name: de.neural_audio.speed })
  expect(fireEvent.click(select)).toBe(true)
  fireEvent.change(select, { target: { value: '0.75' } })
  expect(select).toHaveValue('0.75')
  touchTap(container.querySelector('audio')!.parentElement!.parentElement!)
  expect(card).toHaveClass('is-revealed')
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
})

it('keeps native playback controls usable after Safari requires another playback gesture', async () => {
  jest.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('Tap required', 'NotAllowedError'))
  const { card, container } = mount()
  fireEvent.click(screen.getByRole('button', { name: /Haus.*anhören/ }))
  const audio = container.querySelector('audio')!
  await waitFor(() => expect(audio).toHaveAttribute('controls'))
  expect(fireEvent.click(audio)).toBe(true)
  expect(card).toHaveClass('is-revealed')
})

it('preserves keyboard pronunciation and normal card flipping with touch, Enter and Space', () => {
  const { card, container } = mount()
  const audioButton = screen.getByRole('button', { name: /Haus.*anhören/ })
  expect(fireEvent.keyDown(audioButton, { key: 'Enter' })).toBe(true)
  fireEvent.click(audioButton, { detail: 0 })
  expect(card).toHaveClass('is-revealed')
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)

  touchTap(container.querySelector('.learning-flip-back .learning-solution')!)
  expect(card).not.toHaveClass('is-revealed')
  const front = container.querySelector('.learning-flip-front .learning-card-content')!
  expect(fireEvent.keyDown(front, { key: 'Enter' })).toBe(false)
  expect(card).toHaveClass('is-revealed')
  const back = container.querySelector('.learning-flip-back .learning-card-content')!
  expect(fireEvent.keyDown(back, { key: ' ' })).toBe(false)
  expect(card).not.toHaveClass('is-revealed')
})

it.each(['travel', 'scroll', 'cancel'] as const)('does not flip after a %s gesture in a scrollable solution, then accepts a fresh tap', gesture => {
  const { card, container } = mount()
  const solution = container.querySelector('.learning-flip-back .learning-solution')!
  const body = container.querySelector('.learning-flip-back .learning-card-content')!
  cardPointer(solution, 'pointerdown')
  if (gesture === 'travel') cardPointer(solution, 'pointermove', { clientY: 130 })
  if (gesture === 'scroll') fireEvent.scroll(body, { target: { scrollTop: 35 } })
  if (gesture === 'cancel') cardPointer(solution, 'pointercancel')
  cardPointer(solution, 'pointerup')
  fireEvent.click(solution, { detail: 1 })
  expect(card).toHaveClass('is-revealed')

  cardPointer(solution, 'pointerdown')
  cardPointer(solution, 'pointerup', { clientX: 152, clientY: 102 })
  fireEvent.click(solution, { detail: 1 })
  expect(card).not.toHaveClass('is-revealed')
})

it('keeps a card revealed when its native scrollbar is clicked and allows the next content tap', () => {
  const { card, container } = mount()
  const body = container.querySelector('.learning-flip-back .learning-card-content')!
  Object.defineProperties(body, {
    scrollHeight: { configurable: true, value: 800 }, clientHeight: { configurable: true, value: 250 },
    offsetWidth: { configurable: true, value: 300 }, clientWidth: { configurable: true, value: 284 },
  })
  jest.spyOn(body, 'getBoundingClientRect').mockReturnValue({ left: 40, right: 340, top: 80, bottom: 330, width: 300, height: 250, x: 40, y: 80, toJSON: () => ({}) })
  cardPointer(body, 'pointerdown', { clientX: 335, pointerType: 'mouse' })
  cardPointer(body, 'pointerup', { clientX: 335, pointerType: 'mouse' })
  fireEvent.click(body, { clientX: 335, detail: 1 })
  expect(card).toHaveClass('is-revealed')

  cardPointer(body, 'pointerdown')
  cardPointer(body, 'pointerup')
  fireEvent.click(body, { detail: 1 })
  expect(card).not.toHaveClass('is-revealed')
})

it('allows keyboard and assistive activation after a cancelled scroll gesture', () => {
  const { card, container } = mount()
  const body = container.querySelector('.learning-flip-back .learning-card-content')!
  cardPointer(body, 'pointerdown')
  cardPointer(body, 'pointercancel')
  fireEvent.keyDown(body, { key: ' ' })
  expect(card).not.toHaveClass('is-revealed')

  const front = container.querySelector('.learning-flip-front .learning-card-content')!
  cardPointer(front, 'pointerdown')
  cardPointer(front, 'pointercancel')
  fireEvent.click(front, { detail: 0 })
  expect(card).toHaveClass('is-revealed')
})
