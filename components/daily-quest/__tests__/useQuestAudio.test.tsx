import { act, fireEvent, render, screen } from '@testing-library/react'
import { useQuestAudio } from '../useQuestAudio'
import { cachedNeuralAudio, resolveNeuralAudio } from '@/lib/audio/neural-client'

jest.mock('@/lib/audio/neural-client', () => ({
  cachedNeuralAudio: jest.fn(), resolveNeuralAudio: jest.fn(), invalidateNeuralAudio: jest.fn(),
  neuralAudioKey: (source: { text: string; voice?: string }) => JSON.stringify([source.text, source.voice]),
}))
const scene = { text: 'Guten Morgen!', language: 'de' } as const
const word = { text: 'Das Brötchen.', language: 'de' } as const
function Harness({ scope = 'intro' }: { scope?: string }) {
  const { play, state, audioRef, audioEvents } = useQuestAudio(scope, 0.85)
  return <><button onClick={() => play(scene)}>Scene</button><button onClick={() => play(word)}>Word</button>
    <span role="status">{state.phase}</span><audio ref={audioRef} {...audioEvents} controls={state.phase === 'ready'} /></>
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(next => { resolve = next })
  return { promise, resolve }
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(cachedNeuralAudio).mockReturnValue(null)
  jest.mocked(resolveNeuralAudio).mockResolvedValue('/voice.wav')
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function () { this.dispatchEvent(new Event('playing')); return Promise.resolve() })
})
afterEach(() => jest.restoreAllMocks())

it('unlocks the same native player synchronously and waits for the unlock before replacing its source', async () => {
  const synthesis = deferred<string>(); const unlock = deferred<void>()
  jest.mocked(resolveNeuralAudio).mockReturnValueOnce(synthesis.promise)
  jest.mocked(HTMLMediaElement.prototype.play).mockReturnValueOnce(unlock.promise)
  const { container } = render(<Harness />)
  const player = container.querySelector('audio')!
  fireEvent.click(screen.getByRole('button', { name: 'Scene' }))
  expect(player.src).toMatch(/^data:audio\/wav/u)
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
  await act(async () => synthesis.resolve('/generated-scene.wav'))
  expect(player.src).toMatch(/^data:audio\/wav/u)
  await act(async () => unlock.resolve())
  expect(player.getAttribute('src')).toBe('/generated-scene.wav')
  expect(jest.mocked(HTMLMediaElement.prototype.play).mock.instances).toEqual([player, player])
  expect(player.playbackRate).toBe(0.85)
  expect(screen.getByRole('status')).toHaveTextContent('playing')
})

it('cancels a repeated pending tap without late playback', async () => {
  const synthesis = deferred<string>()
  jest.mocked(resolveNeuralAudio).mockReturnValueOnce(synthesis.promise)
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Scene' }))
  fireEvent.click(screen.getByRole('button', { name: 'Scene' }))
  await act(async () => synthesis.resolve('/cancelled.wav'))
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('status')).toHaveTextContent('idle')
})

it('never lets a late word request replace the newer scene source', async () => {
  const synthesis = deferred<string>()
  jest.mocked(resolveNeuralAudio).mockReturnValueOnce(synthesis.promise)
  jest.mocked(cachedNeuralAudio).mockImplementation(source => source.text === scene.text ? '/scene.wav' : null)
  const { container } = render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Word' }))
  fireEvent.click(screen.getByRole('button', { name: 'Scene' }))
  await act(async () => synthesis.resolve('/old-word.wav'))
  expect(container.querySelector('audio')?.getAttribute('src')).toBe('/scene.wav')
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
})

it('clears playback and busy state when the station changes', async () => {
  const synthesis = deferred<string>()
  jest.mocked(resolveNeuralAudio).mockReturnValueOnce(synthesis.promise)
  const { rerender } = render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Scene' }))
  expect(screen.getByRole('status')).toHaveTextContent('loading')
  rerender(<Harness scope="dialogue" />)
  await act(async () => synthesis.resolve('/old-scene.wav'))
  expect(screen.getByRole('status')).toHaveTextContent('idle')
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
})

it('pauses on unmount and ignores the pending synthesis result', async () => {
  const synthesis = deferred<string>()
  jest.mocked(resolveNeuralAudio).mockReturnValueOnce(synthesis.promise)
  const { unmount } = render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Scene' }))
  unmount()
  await act(async () => synthesis.resolve('/unmounted.wav'))
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
})

it('offers native controls when Safari needs another gesture and retains the transcript', async () => {
  jest.mocked(cachedNeuralAudio).mockReturnValue('/scene.wav')
  jest.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('Gesture required', 'NotAllowedError'))
  const { container } = render(<Harness />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Scene' })))
  expect(screen.getByRole('status')).toHaveTextContent('ready')
  expect(container.querySelector('audio')).toHaveAttribute('controls')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Scene' })))
  expect(screen.getByRole('status')).toHaveTextContent('playing')
})

it('keeps synthesis errors visible even after the silent unlock ends and allows an explicit retry', async () => {
  jest.mocked(resolveNeuralAudio).mockRejectedValueOnce(new Error('Unavailable'))
  const { container } = render(<Harness />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Scene' })))
  expect(screen.getByRole('status')).toHaveTextContent('error')
  fireEvent.ended(container.querySelector('audio')!)
  expect(screen.getByRole('status')).toHaveTextContent('error')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Scene' })))
  expect(resolveNeuralAudio).toHaveBeenLastCalledWith(scene, true)
  expect(screen.getByRole('status')).toHaveTextContent('playing')
})
