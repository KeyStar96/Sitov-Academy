import { fireEvent, render, screen } from '@testing-library/react'
import WaveformPlayer from '@/components/audio/WaveformPlayer'
import { useAudioPlayback, type UseAudioPlaybackResult } from '@/lib/audio/useAudioPlayback'

jest.unmock('lucide-react')
jest.mock('@/lib/audio/useAudioPlayback', () => ({ useAudioPlayback: jest.fn() }))
jest.mock('@/components/audio/FluidWaveform', () => ({ __esModule: true, default: () => <div /> }))
let playback: UseAudioPlaybackResult
beforeEach(() => {
  jest.clearAllMocks()
  playback = { error: null, isPlaying: false, isBuffering: false, currentTime: 12, duration: 60, htmlAudioRef: { current: null }, getVolume: () => 0, getTone: () => 0, play: jest.fn(), pause: jest.fn(), seek: jest.fn() }
  jest.mocked(useAudioPlayback).mockImplementation(() => playback)
})
it.each([['ArrowRight', 17], ['ArrowLeft', 7], ['ArrowUp', 17], ['ArrowDown', 7], ['Home', 0], ['End', 60]])('seeks meaningfully using %s', (key, target) => {
  render(<WaveformPlayer src="test.wav" />)
  fireEvent.keyDown(screen.getByRole('slider'), { key })
  expect(playback.seek).toHaveBeenCalledWith(target)
})
it('supports precise touch/pointer seeking and disables an unavailable timeline', () => {
  const { rerender } = render(<WaveformPlayer src="test.wav" />)
  fireEvent.change(screen.getByRole('slider'), { target: { value: '27.75' } })
  expect(playback.seek).toHaveBeenCalledWith(27.75)
  playback.duration = 0
  rerender(<WaveformPlayer src="test.wav" />)
  expect(screen.getByRole('slider')).toBeDisabled()
})
it('stops playback when a conversation player unmounts', () => {
  const { unmount } = render(<WaveformPlayer src="test.wav" />)
  unmount()
  expect(playback.pause).toHaveBeenCalledTimes(1)
})
