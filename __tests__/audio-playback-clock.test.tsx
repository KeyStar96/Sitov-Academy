import { act, fireEvent, render, screen } from '@testing-library/react'
import { useAudioPlayback } from '@/lib/audio/useAudioPlayback'

jest.mock('@/lib/audio/web-audio', () => ({
  browserPrefersMp4Recording: () => false,
  decodeFromSource: jest.fn(),
  ensureAudioContext: () => null,
  prepareHtmlAudioElement: jest.fn(),
  requestPlaybackAudioSession: jest.fn(),
}))

const frames = new Map<number, FrameRequestCallback>()
let frameId = 0

function Player({ rate = 1 }: { rate?: number }) {
  const { htmlAudioRef, currentTime } = useAudioPlayback('reference.mp3', rate)
  return <><audio ref={htmlAudioRef} /><output data-testid="time">{currentTime}</output></>
}

beforeEach(() => {
  frames.clear()
  frameId = 0
  jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably')
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    const id = ++frameId
    frames.set(id, callback)
    return id
  })
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id) })
})

afterEach(() => { jest.restoreAllMocks() })

function nextFrame() {
  const [id, callback] = [...frames.entries()][0]
  frames.delete(id)
  act(() => callback(0))
}

it('updates highlighting from the native audio clock between timeupdate events and preserves pitch', () => {
  const { container, rerender, unmount } = render(<Player rate={0.85} />)
  const audio = container.querySelector('audio')!
  expect(audio.playbackRate).toBe(0.85)
  expect(audio.preservesPitch).toBe(true)
  fireEvent.play(audio)
  audio.currentTime = 0.21
  nextFrame()
  expect(screen.getByTestId('time')).toHaveTextContent('0.21')
  rerender(<Player rate={1.25} />)
  expect(audio.playbackRate).toBe(1.25)
  expect(audio.currentTime).toBe(0.21)
  expect(audio.preservesPitch).toBe(true)
  audio.currentTime = 0.63
  nextFrame()
  expect(screen.getByTestId('time')).toHaveTextContent('0.63')
  fireEvent.pause(audio)
  expect(frames.size).toBe(0)
  fireEvent.play(audio)
  expect(frames.size).toBe(1)
  unmount()
  expect(frames.size).toBe(0)
})

it('retains final source time so the player can clear highlighting when playback ends', () => {
  const { container } = render(<Player />)
  const audio = container.querySelector('audio')!
  fireEvent.play(audio)
  audio.currentTime = 10
  fireEvent.ended(audio)
  expect(screen.getByTestId('time')).toHaveTextContent('10')
  expect(frames.size).toBe(0)
})
