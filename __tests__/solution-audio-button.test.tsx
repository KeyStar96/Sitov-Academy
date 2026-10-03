import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import SolutionAudioButton from '@/components/exercises/SolutionAudioButton'
import { generateAudio } from '@/app/actions/generate-audio'
import type { GenerateAudioResult } from '@/lib/types/audio'
import dictionary from '@/dictionaries/de.json'
import { PLAYBACK_RATE_STORAGE_KEY } from '@/lib/audio/usePlaybackRate'
import { createRef } from 'react'
import type { SitovAudioControl } from '@/components/exercises/SolutionAudioButton'

jest.unmock('lucide-react')
jest.mock('@/app/actions/generate-audio', () => ({ generateAudio: jest.fn() }))

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  let reject: (reason: Error) => void = () => undefined
  const promise = new Promise<T>((onResolve, onReject) => { resolve = onResolve; reject = onReject })
  return { promise, resolve, reject }
}

let sequence = 0
function props() {
  sequence += 1
  return { text: `das Testwort ${sequence}`, label: 'Anhören', ariaLabel: `Wort ${sequence} anhören` }
}

function playMedia(this: HTMLMediaElement) {
  this.dispatchEvent(new Event('play'))
  this.dispatchEvent(new Event('playing'))
  return Promise.resolve()
}

beforeEach(() => {
  localStorage.clear()
  jest.clearAllMocks()
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(playMedia)
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function () { this.dispatchEvent(new Event('pause')) })
  jest.mocked(generateAudio).mockResolvedValue({ success: true, audioUrl: 'https://media.example.com/generated.mp3', cached: true })
})
afterEach(() => jest.restoreAllMocks())

it('restores the account reading position once metadata arrives and preserves explicit replay', () => {
  const input = props()
  const { container } = render(<SolutionAudioButton {...input} audioUrl="https://media.example.com/resume.mp3" initialProgress={0.4} onProgress={jest.fn()} />)
  const audio = container.querySelector('audio')!
  Object.defineProperty(audio, 'duration', { configurable: true, value: 100 })
  fireEvent.loadedMetadata(audio)
  expect(audio.currentTime).toBe(40)
  audio.currentTime = 65
  fireEvent.canPlay(audio)
  expect(audio.currentTime).toBe(65)
  fireEvent.click(screen.getByRole('button', { name: dictionary.neural_audio.slow_repeat }))
  expect(audio.currentTime).toBe(0)
})

it('reports the final native reading clock when closing before refs are cleared', () => {
  const onProgress = jest.fn(), input = props()
  const { container, unmount } = render(<SolutionAudioButton {...input} audioUrl="https://media.example.com/final-position.mp3" onProgress={onProgress} />)
  const audio = container.querySelector('audio')!
  Object.defineProperty(audio, 'duration', { configurable: true, value: 100 })
  audio.currentTime = 61
  unmount()
  expect(onProgress).toHaveBeenCalledWith(0.61)
  expect(onProgress).toHaveBeenLastCalledWith(null)
})

it.each(['click', 'pointerDown', 'pointerUp', 'touchStart', 'touchEnd', 'keyDown'] as const)(
  'owns the complete audio-area %s interaction without cancelling native defaults', eventType => {
    const bubbled = jest.fn()
    render(<article onClick={bubbled} onPointerDown={bubbled} onPointerUp={bubbled}
      onTouchStart={bubbled} onTouchEnd={bubbled} onKeyDown={bubbled}>
      <SolutionAudioButton {...props()} audioUrl="https://media.example.com/interaction.mp3" />
    </article>)
    const label = screen.getByText(dictionary.neural_audio.speed)
    const event = createEvent[eventType](label, { bubbles: true, cancelable: true, key: 'Enter', pointerType: 'touch' })
    fireEvent(label, event)
    expect(bubbled).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  },
)

it('plays an existing MP3 synchronously during the click gesture', () => {
  const input = props()
  let inClick = false
  let synchronous = false
  jest.mocked(HTMLMediaElement.prototype.play).mockImplementation(function () {
    synchronous = inClick
    return playMedia.call(this)
  })
  const { container } = render(<SolutionAudioButton {...input} audioUrl="https://media.example.com/cached.mp3" />)
  inClick = true
  fireEvent.click(screen.getByRole('button', { name: input.ariaLabel }))
  inClick = false
  expect(synchronous).toBe(true)
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
  expect(generateAudio).not.toHaveBeenCalled()
  expect(container.querySelector('audio')?.src).toBe('https://media.example.com/cached.mp3')
  expect(screen.getByRole('button', { name: dictionary.neural_audio.pause })).toHaveAttribute('aria-pressed', 'true')
})

it('unlocks the same native player in the first tap and automatically speaks after delayed synthesis', async () => {
  const request = deferred<GenerateAudioResult>()
  const allowedPlayers = new WeakSet<HTMLMediaElement>()
  const playedSources: string[] = []
  let inClick = false
  jest.mocked(generateAudio).mockReturnValueOnce(request.promise)
  jest.mocked(HTMLMediaElement.prototype.play).mockImplementation(function () {
    if (inClick) allowedPlayers.add(this)
    if (!allowedPlayers.has(this)) return Promise.reject(new DOMException('User gesture required', 'NotAllowedError'))
    playedSources.push(this.src)
    return playMedia.call(this)
  })
  const input = props()
  const { container } = render(<SolutionAudioButton {...input} />)
  const player = container.querySelector('audio')
  inClick = true
  fireEvent.click(screen.getByRole('button', { name: input.ariaLabel }))
  inClick = false
  expect(playedSources).toEqual([expect.stringMatching(/^data:audio\/wav;base64,/u)])
  expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  await act(async () => { request.resolve({ success: true, audioUrl: 'https://media.example.com/first-tap.mp3', cached: false }) })
  expect(playedSources).toEqual([expect.stringMatching(/^data:audio\/wav;base64,/u), 'https://media.example.com/first-tap.mp3'])
  expect(jest.mocked(HTMLMediaElement.prototype.play).mock.instances).toEqual([player, player])
  expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'false')
  expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByText(dictionary.neural_audio.ready)).not.toBeInTheDocument()
  expect(generateAudio).toHaveBeenCalledTimes(1)
})

it('does not interrupt the gesture unlock when the URL resolves before the silent player starts', async () => {
  const request = deferred<GenerateAudioResult>()
  const unlock = deferred<void>()
  jest.mocked(generateAudio).mockReturnValueOnce(request.promise)
  jest.mocked(HTMLMediaElement.prototype.play).mockReturnValueOnce(unlock.promise)
  const input = props()
  const { container } = render(<SolutionAudioButton {...input} />)
  fireEvent.click(screen.getByRole('button', { name: input.ariaLabel }))
  await act(async () => { request.resolve({ success: true, audioUrl: 'https://media.example.com/race.mp3', cached: false }) })
  expect(container.querySelector('audio')?.src).toMatch(/^data:audio\/wav;/u)
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
  await act(async () => { unlock.resolve() })
  expect(container.querySelector('audio')?.src).toBe('https://media.example.com/race.mp3')
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
})

it('allows cancelling a pending pronunciation without late playback or losing the cached result', async () => {
  const request = deferred<GenerateAudioResult>()
  jest.mocked(generateAudio).mockReturnValueOnce(request.promise)
  const input = props()
  render(<SolutionAudioButton {...input} />)
  fireEvent.click(screen.getByRole('button', { name: input.ariaLabel }))
  fireEvent.click(screen.getByRole('button', { name: dictionary.neural_audio.pause }))
  await act(async () => { request.resolve({ success: true, audioUrl: 'https://media.example.com/cancelled.mp3', cached: false }) })
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'false')
  fireEvent.click(screen.getByRole('button', { name: input.ariaLabel }))
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
  expect(generateAudio).toHaveBeenCalledTimes(1)
})

it('pauses and cancels the pending player on unmount', async () => {
  const request = deferred<GenerateAudioResult>()
  jest.mocked(generateAudio).mockReturnValueOnce(request.promise)
  const input = props()
  const { container, unmount } = render(<SolutionAudioButton {...input} />)
  const player = container.querySelector('audio')
  fireEvent.click(screen.getByRole('button', { name: input.ariaLabel }))
  unmount()
  await act(async () => { request.resolve({ success: true, audioUrl: 'https://media.example.com/unmounted.mp3', cached: false }) })
  expect(jest.mocked(HTMLMediaElement.prototype.pause).mock.instances).toContain(player)
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
})

it('pauses a playing card when its text changes', () => {
  const input = props()
  const { container, rerender } = render(<SolutionAudioButton {...input} audioUrl="https://media.example.com/old.mp3" />)
  const first = container.querySelector('audio')
  fireEvent.click(screen.getByRole('button', { name: input.ariaLabel }))
  jest.mocked(HTMLMediaElement.prototype.pause).mockClear()
  rerender(<SolutionAudioButton {...props()} audioUrl="https://media.example.com/new.mp3" />)
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1)
  expect(jest.mocked(HTMLMediaElement.prototype.pause).mock.instances[0]).toBe(first)
  expect(container.querySelector('audio')).not.toBe(first)
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
})

it('never plays a late generated MP3 after moving to a different card', async () => {
  const request = deferred<GenerateAudioResult>()
  jest.mocked(generateAudio).mockReturnValueOnce(request.promise)
  const oldInput = props()
  const { container, rerender } = render(<SolutionAudioButton {...oldInput} />)
  fireEvent.click(screen.getByRole('button', { name: oldInput.ariaLabel }))
  const nextInput = props()
  rerender(<SolutionAudioButton {...nextInput} audioUrl="https://media.example.com/next.mp3" />)
  const current = container.querySelector('audio')
  await act(async () => { request.resolve({ success: true, audioUrl: 'https://media.example.com/late.mp3', cached: false }) })
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
  expect(current?.src).toBe('https://media.example.com/next.mp3')
})

it('deduplicates concurrent synthesis and reuses the resolved URL on a later mount', async () => {
  const request = deferred<GenerateAudioResult>()
  jest.mocked(generateAudio).mockReturnValueOnce(request.promise)
  const input = props()
  const first = render(<><SolutionAudioButton {...input} /><SolutionAudioButton {...input} /></>)
  expect(generateAudio).toHaveBeenCalledTimes(1)
  await act(async () => { request.resolve({ success: true, audioUrl: 'https://media.example.com/shared.mp3', cached: true }) })
  expect(Array.from(first.container.querySelectorAll('audio')).every(audio => audio.src === 'https://media.example.com/shared.mp3')).toBe(true)
  first.unmount()
  render(<SolutionAudioButton {...input} />)
  expect(generateAudio).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: input.ariaLabel }))
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
})

it('pauses the previous player when another button starts', () => {
  const first = props()
  const second = props()
  const { container } = render(<><SolutionAudioButton {...first} audioUrl="https://media.example.com/a.mp3" /><SolutionAudioButton {...second} audioUrl="https://media.example.com/b.mp3" /></>)
  const players = container.querySelectorAll('audio')
  fireEvent.click(screen.getByRole('button', { name: first.ariaLabel }))
  fireEvent.click(screen.getByRole('button', { name: second.ariaLabel }))
  expect(jest.mocked(HTMLMediaElement.prototype.pause).mock.instances).toContain(players[0])
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
})

it('offers native controls after Safari rejects autoplay and retries within the next gesture', async () => {
  const input = props()
  const onUnsupported = jest.fn()
  jest.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('gesture required', 'NotAllowedError'))
  const { container } = render(<SolutionAudioButton {...input} audioUrl="https://media.example.com/safari.mp3" onUnsupported={onUnsupported} />)
  fireEvent.click(screen.getByRole('button', { name: input.ariaLabel }))
  expect(await screen.findByText(dictionary.neural_audio.ready)).toBeInTheDocument()
  expect(container.querySelector('audio')).toHaveAttribute('controls')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(onUnsupported).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: input.ariaLabel }))
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
  expect(container.querySelector('audio')).not.toHaveAttribute('controls')
  expect(screen.getByRole('button', { name: dictionary.neural_audio.pause })).toBeInTheDocument()
})

it('shows a localized retry after generation fails and starts the successful retry', async () => {
  const input = props()
  const request = deferred<GenerateAudioResult>()
  const onUnsupported = jest.fn()
  jest.mocked(generateAudio).mockReturnValueOnce(request.promise)
  render(<SolutionAudioButton {...input} onUnsupported={onUnsupported} />)
  fireEvent.click(screen.getByRole('button', { name: input.ariaLabel }))
  await act(async () => { request.resolve({ success: false, error: 'audio_unavailable' }) })
  expect(screen.getByRole('alert')).toHaveTextContent(dictionary.neural_audio.error)
  expect(onUnsupported).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: dictionary.neural_audio.retry }))
  await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(3))
  expect(generateAudio).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('replaces a broken media URL when playback emits an error', async () => {
  const input = props()
  const { container } = render(<SolutionAudioButton {...input} audioUrl="https://media.example.com/broken.mp3" />)
  const player = container.querySelector('audio')
  if (!player) throw new Error('Expected media element')
  fireEvent.error(player)
  expect(screen.getByRole('alert')).toHaveTextContent(dictionary.neural_audio.error)
  fireEvent.click(screen.getByRole('button', { name: dictionary.neural_audio.retry }))
  await waitFor(() => expect(player.src).toBe('https://media.example.com/generated.mp3'))
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
})

it('does not let an older pending click interrupt a more recently selected player', async () => {
  const request = deferred<GenerateAudioResult>()
  jest.mocked(generateAudio).mockReturnValueOnce(request.promise)
  const first = props()
  const second = props()
  const { container } = render(<><SolutionAudioButton {...first} /><SolutionAudioButton {...second} audioUrl="https://media.example.com/newest.mp3" /></>)
  fireEvent.click(screen.getByRole('button', { name: first.ariaLabel }))
  fireEvent.click(screen.getByRole('button', { name: second.ariaLabel }))
  await act(async () => { request.resolve({ success: true, audioUrl: 'https://media.example.com/older.mp3', cached: false }) })
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
  expect(jest.mocked(HTMLMediaElement.prototype.play).mock.instances[1]).toBe(container.querySelectorAll('audio')[1])
})

it('also pauses the previous player when native Safari controls start playback', async () => {
  const first = props()
  const second = props()
  jest.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('gesture required', 'NotAllowedError'))
  const { container } = render(<><SolutionAudioButton {...first} audioUrl="https://media.example.com/native.mp3" /><SolutionAudioButton {...second} audioUrl="https://media.example.com/other.mp3" /></>)
  fireEvent.click(screen.getByRole('button', { name: first.ariaLabel }))
  await screen.findByText(dictionary.neural_audio.ready)
  fireEvent.click(screen.getByRole('button', { name: second.ariaLabel }))
  jest.mocked(HTMLMediaElement.prototype.pause).mockClear()
  const players = container.querySelectorAll('audio')
  fireEvent.play(players[0])
  expect(jest.mocked(HTMLMediaElement.prototype.pause).mock.instances).toContain(players[1])
})

it('does not report an intentional interrupted play as an audio failure', async () => {
  const request = deferred<void>()
  jest.mocked(HTMLMediaElement.prototype.play).mockReturnValueOnce(request.promise)
  const first = props()
  const second = props()
  render(<><SolutionAudioButton {...first} audioUrl="https://media.example.com/interrupted.mp3" /><SolutionAudioButton {...second} audioUrl="https://media.example.com/preferred.mp3" /></>)
  fireEvent.click(screen.getByRole('button', { name: first.ariaLabel }))
  fireEvent.click(screen.getByRole('button', { name: second.ariaLabel }))
  await act(async () => { request.reject(new DOMException('play interrupted by pause', 'AbortError')) })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('starts A courses at 0.85 and keeps a manually selected speed across cards', () => {
  const input = props()
  const { container, rerender } = render(<SolutionAudioButton {...input} level="A1.1" audioUrl="https://media.example.com/level.mp3" />)
  const speed = screen.getByRole('combobox', { name: dictionary.neural_audio.speed })
  expect(speed).toHaveValue('0.85')
  expect(container.querySelector('audio')?.playbackRate).toBe(0.85)
  fireEvent.change(speed, { target: { value: '0.75' } })
  expect(container.querySelector('audio')?.playbackRate).toBe(0.75)
  expect(container.querySelector('audio')?.preservesPitch).toBe(true)
  rerender(<SolutionAudioButton {...props()} level="B1" audioUrl="https://media.example.com/next-level.mp3" />)
  expect(speed).toHaveValue('0.75')
  expect(container.querySelector('audio')?.playbackRate).toBe(0.75)
})

it('uses the latest speed when synthesis completes after a speed change', async () => {
  const request = deferred<GenerateAudioResult>()
  jest.mocked(generateAudio).mockReturnValueOnce(request.promise)
  const input = props()
  const { container } = render(<SolutionAudioButton {...input} level="A2" />)
  fireEvent.click(screen.getByRole('button', { name: input.ariaLabel }))
  fireEvent.change(screen.getByRole('combobox', { name: dictionary.neural_audio.speed }), { target: { value: '0.75' } })
  await act(async () => request.resolve({ success: true, audioUrl: 'https://media.example.com/rate-after-generation.mp3', cached: false }))
  expect(container.querySelector('audio')?.playbackRate).toBe(0.75)
})

it('follows exact word boundaries on the media clock at all speeds and clears pauses', async () => {
  const onWordChange = jest.fn()
  const frames: FrameRequestCallback[] = []
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length })
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
  jest.mocked(generateAudio).mockResolvedValueOnce({ success: true, audioUrl: 'https://media.example.com/aligned.mp3', cached: false,
    wordTimings: [{ start: 0.1, end: 0.4 }, { start: 0.6, end: 2.2 }] })
  const input = props()
  const { container } = render(<SolutionAudioButton {...input} level="A1" onWordChange={onWordChange} />)
  await act(async () => { await Promise.resolve() })
  const audio = container.querySelector('audio')!
  Object.defineProperty(audio, 'duration', { configurable: true, value: 2.5 })
  fireEvent.click(screen.getByRole('button', { name: input.ariaLabel }))
  const frame = (seconds: number) => act(() => { audio.currentTime = seconds; frames.shift()?.(performance.now()) })
  frame(0.2)
  expect(onWordChange).toHaveBeenLastCalledWith(0)
  fireEvent.change(screen.getByRole('combobox', { name: dictionary.neural_audio.speed }), { target: { value: '0.75' } })
  frame(0.5)
  expect(onWordChange).toHaveBeenLastCalledWith(null)
  frame(0.7)
  expect(onWordChange).toHaveBeenLastCalledWith(1)
  fireEvent.change(screen.getByRole('combobox', { name: dictionary.neural_audio.speed }), { target: { value: '1.25' } })
  frame(2)
  expect(onWordChange).toHaveBeenLastCalledWith(1)
  fireEvent.pause(audio)
  expect(onWordChange).toHaveBeenLastCalledWith(null)
  expect(window.cancelAnimationFrame).toHaveBeenCalled()
})

it('offers speed controls without a voice selector', () => {
  const input = props()
  render(<SolutionAudioButton {...input} audioUrl="https://media.example.com/original.mp3" />)
  expect(screen.getAllByRole('combobox')).toHaveLength(1)
  expect(screen.getByRole('combobox', { name: dictionary.neural_audio.speed })).toBeInTheDocument()
})

it('exposes clear pause/resume and restarts the full reading without losing a paused position', () => {
  const input = props()
  const controlRef = createRef<SitovAudioControl>()
  const { container } = render(<SolutionAudioButton {...input} audioUrl="https://media.example.com/reading-controls.mp3" onProgress={jest.fn()}
    layout="reading" resumeLabel="Weiterhören" restartLabel="Von vorn" restartAriaLabel="Text von Anfang an anhören" controlRef={controlRef} />)
  const audio = container.querySelector('audio')!
  fireEvent.click(screen.getByRole('button', { name: input.ariaLabel }))
  audio.currentTime = 2.5
  act(() => controlRef.current?.pause())
  expect(audio.currentTime).toBe(2.5)
  fireEvent.click(screen.getByRole('button', { name: 'Weiterhören' }))
  expect(audio.currentTime).toBe(2.5)
  fireEvent.click(screen.getByRole('button', { name: 'Text von Anfang an anhören' }))
  expect(audio.currentTime).toBe(0)
  expect(audio.playbackRate).toBe(1)
})

it('starts delayed speech at its own zero instead of carrying over the silent unlock clock', async () => {
  const request = deferred<GenerateAudioResult>()
  jest.mocked(generateAudio).mockReturnValueOnce(request.promise)
  const input = props()
  const { container } = render(<SolutionAudioButton {...input} onWordChange={jest.fn()} />)
  const audio = container.querySelector('audio')!
  fireEvent.click(screen.getByRole('button', { name: input.ariaLabel }))
  audio.currentTime = 0.01
  await act(async () => request.resolve({ success: true, audioUrl: 'https://media.example.com/full-reading.mp3', cached: false }))
  expect(audio.currentTime).toBe(0)
})

it('allows the word lookup to cancel pending synthesis before it can start speaking late', async () => {
  const request = deferred<GenerateAudioResult>()
  jest.mocked(generateAudio).mockReturnValueOnce(request.promise)
  const input = props()
  const controlRef = createRef<SitovAudioControl>()
  render(<SolutionAudioButton {...input} controlRef={controlRef} />)
  fireEvent.click(screen.getByRole('button', { name: input.ariaLabel }))
  act(() => controlRef.current?.pause())
  await act(async () => request.resolve({ success: true, audioUrl: 'https://media.example.com/cancel-before-lookup.mp3', cached: false }))
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'false')
})

it('restores the chosen speed after the next card remounts and on a later visit', () => {
  const first = render(<SolutionAudioButton {...props()} level="A1" audioUrl="https://media.example.com/first.mp3" />)
  fireEvent.change(screen.getByRole('combobox', { name: dictionary.neural_audio.speed }), { target: { value: '0.75' } })
  expect(localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY)).toBe('0.75')
  first.unmount()
  const second = render(<SolutionAudioButton {...props()} level="B1" audioUrl="https://media.example.com/second.mp3" />)
  expect(screen.getByRole('combobox', { name: dictionary.neural_audio.speed })).toHaveValue('0.75')
  expect(second.container.querySelector('audio')?.playbackRate).toBe(0.75)
  second.unmount()
  // Stored state alone is enough, including before any card is played.
  localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, '1.25')
  const nextVisit = render(<SolutionAudioButton {...props()} level="A2" audioUrl="https://media.example.com/visit.mp3" />)
  expect(nextVisit.container.querySelector('audio')?.playbackRate).toBe(1.25)
})

it('repeats the current sentence immediately at 0.75 without another synthesis request', async () => {
  const input = props()
  const onProgress = jest.fn()
  const { container } = render(<SolutionAudioButton {...input} audioUrl="https://media.example.com/repeat.mp3" onProgress={onProgress} />)
  fireEvent.click(screen.getByRole('button', { name: input.ariaLabel }))
  const audio = container.querySelector('audio')!
  audio.currentTime = 2
  fireEvent.click(screen.getByRole('button', { name: dictionary.neural_audio.slow_repeat }))
  expect(audio.currentTime).toBe(0)
  expect(audio.playbackRate).toBe(0.75)
  expect(screen.getByRole('combobox', { name: dictionary.neural_audio.speed })).toHaveValue('0.75')
  expect(localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY)).toBe('0.75')
  expect(generateAudio).not.toHaveBeenCalled()
})
