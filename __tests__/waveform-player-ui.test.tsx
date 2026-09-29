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

it('starts A-level reference recordings at 0.85× and changes their actual playback rate', () => {
  const { rerender } = render(<WaveformPlayer src="test.wav" level="A1.2" />)
  const speed = screen.getByRole('combobox')
  expect(speed).toHaveValue('0.85')
  expect(jest.mocked(useAudioPlayback)).toHaveBeenLastCalledWith('test.wav', 0.85, undefined)
  fireEvent.change(speed, { target: { value: '0.75' } })
  expect(jest.mocked(useAudioPlayback)).toHaveBeenLastCalledWith('test.wav', 0.75, undefined)
  expect(playback.seek).not.toHaveBeenCalled()
  expect(playback.play).not.toHaveBeenCalled()
  rerender(<WaveformPlayer src="test.wav" level="B1" />)
  expect(speed).toHaveValue('1')
  expect(jest.mocked(useAudioPlayback)).toHaveBeenLastCalledWith('test.wav', 1, undefined)
})

it('passes source-clock progress unchanged when the speed changes', () => {
  const onProgress = jest.fn()
  playback.isPlaying = true
  const { rerender } = render(<WaveformPlayer src="test.wav" level="A2" onProgress={onProgress} />)
  expect(onProgress).toHaveBeenLastCalledWith({ playing: true, fraction: 0.2, ended: false })
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '1.25' } })
  playback.currentTime = 15
  rerender(<WaveformPlayer src="test.wav" level="A2" onProgress={onProgress} />)
  expect(onProgress).toHaveBeenLastCalledWith({ playing: true, fraction: 0.25, ended: false })
})
