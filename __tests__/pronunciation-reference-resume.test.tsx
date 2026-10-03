import { render } from '@testing-library/react'
import WaveformPlayer from '@/components/audio/WaveformPlayer'

jest.unmock('lucide-react')
const mockSeek = jest.fn()
const mockAudioRef = { current: null }
let mockDuration = 0
jest.mock('@/lib/audio/useAudioPlayback', () => ({ useAudioPlayback: () => ({
  duration: mockDuration, currentTime: 0, isPlaying: false, isBuffering: false,
  error: null, htmlAudioRef: mockAudioRef, getVolume: () => 0, getTone: () => 0,
  seek: mockSeek, play: jest.fn(), pause: jest.fn(),
}) }))
jest.mock('@/components/audio/FluidWaveform', () => ({ __esModule: true, default: () => null }))

beforeEach(() => { jest.clearAllMocks(); mockDuration = 0; jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {}) })
afterEach(() => jest.restoreAllMocks())

it('restores a saved teacher-reference position after duration is known without seeking again during playback', () => {
  const { rerender } = render(<WaveformPlayer src="reference.mp3" initialProgress={0.4} />)
  expect(mockSeek).not.toHaveBeenCalled()
  mockDuration = 120
  rerender(<WaveformPlayer src="reference.mp3" initialProgress={0.4} />)
  expect(mockSeek).toHaveBeenCalledWith(48)
  mockDuration = 121
  rerender(<WaveformPlayer src="reference.mp3" initialProgress={0.4} />)
  expect(mockSeek).toHaveBeenCalledTimes(1)
})

it('starts a completed reference from the beginning when reviewed later', () => {
  mockDuration = 120
  render(<WaveformPlayer src="reference.mp3" initialProgress={1} />)
  expect(mockSeek).not.toHaveBeenCalled()
})

it('captures the actual native clock on pagehide and unmount before React clears its ref', () => {
  const onProgress = jest.fn()
  const { container, unmount } = render(<WaveformPlayer src="reference.mp3" onProgress={onProgress} />)
  const audio = container.querySelector('audio')!
  Object.defineProperty(audio, 'duration', { configurable: true, value: 100 })
  audio.currentTime = 63
  window.dispatchEvent(new Event('pagehide'))
  expect(onProgress).toHaveBeenLastCalledWith({ playing: false, fraction: 0.63, ended: false })
  audio.currentTime = 67
  unmount()
  expect(onProgress).toHaveBeenLastCalledWith({ playing: false, fraction: 0.67, ended: false })
  expect(mockAudioRef.current).toBeNull()
})
