import { act, fireEvent, render, screen } from '@testing-library/react'
import WaveformPlayer from '@/components/audio/WaveformPlayer'
import { useAudioPlayback, type UseAudioPlaybackResult } from '@/lib/audio/useAudioPlayback'
import { FAST_PLAYBACK_STORAGE_KEY } from '@/lib/audio/useFastPlayback'
import { PLAYBACK_RATE_STORAGE_KEY } from '@/lib/audio/usePlaybackRate'
import { createPronunciationTranslator } from '@/lib/pronunciation-i18n'
import translations from '@/lib/pronunciation-translations.json'

jest.unmock('lucide-react')
jest.mock('@/lib/audio/useAudioPlayback', () => ({ useAudioPlayback: jest.fn() }))
jest.mock('@/components/audio/FluidWaveform', () => ({ __esModule: true, default: () => <div /> }))
const label = translations.de.fast_playback
let playback: UseAudioPlaybackResult
const lastRate = () => jest.mocked(useAudioPlayback).mock.calls.at(-1)?.[1]

beforeEach(() => {
  localStorage.clear()
  jest.clearAllMocks()
  playback = { error: null, isPlaying: false, isBuffering: false, currentTime: 12, duration: 60, htmlAudioRef: { current: null }, getVolume: () => 0, getTone: () => 0, play: jest.fn(), pause: jest.fn(), seek: jest.fn() }
  jest.mocked(useAudioPlayback).mockImplementation(() => playback)
})
afterEach(() => { jest.restoreAllMocks() })

it('offers teachers one 2× switch instead of the learner tempo list and never restarts playback', () => {
  render(<WaveformPlayer src="student.webm" fastToggle />)
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  const toggle = screen.getByRole('button', { name: label })
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect(toggle).toHaveTextContent('2×')
  expect(lastRate()).toBe(1)
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  expect(lastRate()).toBe(2)
  expect(playback.seek).not.toHaveBeenCalled()
  expect(playback.play).not.toHaveBeenCalled()
  expect(playback.pause).not.toHaveBeenCalled()
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect(lastRate()).toBe(1)
})

it('is a 48 px touch target and announces itself in every interface language', () => {
  for (const lang of ['de', 'en', 'ru', 'uk', 'tr'] as const) {
    const view = render(<WaveformPlayer src="student.webm" fastToggle t={createPronunciationTranslator(translations[lang])} />)
    const toggle = screen.getByRole('button', { name: translations[lang].fast_playback })
    expect(toggle).toHaveClass('h-12', 'min-w-16')
    expect(translations[lang].fast_playback).toContain('2×')
    view.unmount()
  }
})

it('applies the choice to every recording in the queue and remembers it for the next visit', () => {
  const first = render(<><WaveformPlayer src="one.webm" fastToggle label="Eins" /><WaveformPlayer src="two.webm" fastToggle label="Zwei" /></>)
  const [one, two] = screen.getAllByRole('button', { name: label })
  fireEvent.click(one)
  expect(two).toHaveAttribute('aria-pressed', 'true')
  expect(jest.mocked(useAudioPlayback).mock.calls.filter(call => call[0] === 'two.webm').at(-1)?.[1]).toBe(2)
  expect(localStorage.getItem(FAST_PLAYBACK_STORAGE_KEY)).toBe('1')
  first.unmount()
  render(<WaveformPlayer src="three.webm" fastToggle />)
  expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true')
  expect(lastRate()).toBe(2)
})

it('keeps the teacher switch and the learner tempo independent of each other', () => {
  localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, '0.75')
  const staff = render(<WaveformPlayer src="student.webm" fastToggle level="A1.1" />)
  expect(lastRate()).toBe(1)
  fireEvent.click(screen.getByRole('button', { name: label }))
  expect(lastRate()).toBe(2)
  expect(localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY)).toBe('0.75')
  staff.unmount()
  render(<WaveformPlayer src="reference.wav" level="A1.1" />)
  expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
  expect(screen.getByRole('combobox')).toHaveValue('0.75')
  expect(lastRate()).toBe(0.75)
})

it('receives the choice made in another tab and ignores a corrupted stored value', () => {
  localStorage.setItem(FAST_PLAYBACK_STORAGE_KEY, 'fast')
  render(<WaveformPlayer src="student.webm" fastToggle />)
  const toggle = screen.getByRole('button', { name: label })
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  act(() => {
    localStorage.setItem(FAST_PLAYBACK_STORAGE_KEY, '1')
    window.dispatchEvent(new StorageEvent('storage', { key: FAST_PLAYBACK_STORAGE_KEY }))
  })
  expect(toggle).toHaveAttribute('aria-pressed', 'true')
})

it('still switches when browser storage is blocked', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
  render(<WaveformPlayer src="student.webm" fastToggle />)
  const toggle = screen.getByRole('button', { name: label })
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  expect(lastRate()).toBe(2)
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
})
