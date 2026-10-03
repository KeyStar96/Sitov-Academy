import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import KaraokeText from '@/components/audio/KaraokeText'
import { getSitovWordMeaning } from '@/app/actions/sitov-word-meaning'
import type { SitovWordMeaningResult } from '@/lib/sitov-word-meaning'

jest.mock('@/app/actions/sitov-word-meaning', () => ({ getSitovWordMeaning: jest.fn() }))
jest.unmock('lucide-react')
const lookup = { promptId: 'text-1', level: 'A1.1', locale: 'en', onSelect: jest.fn() }
const meaning = (word: string, translation: string): SitovWordMeaningResult => ({ ok: true, meaning: { word, base: word, translation, locale: 'en' } })
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getSitovWordMeaning).mockResolvedValue(meaning('Brot.', 'bread'))
})

it('pauses on a tapped word, looks up the current locale and caches repeated words', async () => {
  render(<KaraokeText text="Mein Brot." wordLookup={lookup} />)
  const word = screen.getByRole('button', { name: 'Show the meaning of “Brot.”' })
  fireEvent.click(word)
  expect(lookup.onSelect).toHaveBeenCalledTimes(1)
  expect(await screen.findByText('bread')).toBeVisible()
  expect(getSitovWordMeaning).toHaveBeenCalledWith({ promptId: 'text-1', level: 'A1.1', word: 'Brot.', locale: 'en' })
  expect(word).toHaveAttribute('aria-expanded', 'true')
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(word).toHaveFocus()
  fireEvent.click(word)
  expect(screen.getByText('bread')).toBeVisible()
  expect(getSitovWordMeaning).toHaveBeenCalledTimes(1)
})

it('ignores a late meaning after the learner has selected another word', async () => {
  let first: (value: SitovWordMeaningResult) => void = () => {}
  let second: (value: SitovWordMeaningResult) => void = () => {}
  jest.mocked(getSitovWordMeaning).mockReturnValueOnce(new Promise(resolve => { first = resolve })).mockReturnValueOnce(new Promise(resolve => { second = resolve }))
  render(<KaraokeText text="Hund Brot" wordLookup={lookup} />)
  fireEvent.click(screen.getByRole('button', { name: 'Show the meaning of “Hund”' }))
  await waitFor(() => expect(getSitovWordMeaning).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByRole('button', { name: 'Show the meaning of “Brot”' }))
  await waitFor(() => expect(getSitovWordMeaning).toHaveBeenCalledTimes(2))
  await act(async () => second(meaning('Brot', 'bread')))
  await act(async () => first(meaning('Hund', 'dog')))
  expect(screen.getByRole('dialog')).toHaveTextContent('bread')
  expect(screen.queryByText('dog')).toBeNull()
})

it('keeps the word bubble inside a narrow viewport and dismisses outside taps', async () => {
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 302, right: 320, top: 230, bottom: 274, width: 18, height: 44 } as DOMRect)
  const previousWidth = window.innerWidth
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 })
  render(<KaraokeText text="Brot." wordLookup={lookup} />)
  fireEvent.click(screen.getByRole('button', { name: 'Show the meaning of “Brot.”' }))
  const bubble = await screen.findByRole('dialog')
  expect(bubble).toHaveStyle({ left: '184px', top: '220px' })
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole('dialog')).toBeNull()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: previousWidth })
  jest.restoreAllMocks()
})

it('shows missing translations without another language and supports retry after a failure', async () => {
  jest.mocked(getSitovWordMeaning).mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, meaning: null })
  render(<KaraokeText text="Brot." wordLookup={lookup} />)
  fireEvent.click(screen.getByRole('button', { name: 'Show the meaning of “Brot.”' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('No translation has been added for this word yet.')).toBeVisible()
  expect(getSitovWordMeaning).toHaveBeenCalledTimes(2)
})
