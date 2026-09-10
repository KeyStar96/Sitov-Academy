import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import SolutionAudioButton from '@/components/exercises/SolutionAudioButton'
import { generateAudio } from '@/app/actions/generate-audio'
import type { GenerateAudioResult } from '@/lib/types/audio'
import dictionary from '@/dictionaries/de.json'

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
  jest.clearAllMocks()
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(playMedia)
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function () { this.dispatchEvent(new Event('pause')) })
  jest.mocked(generateAudio).mockResolvedValue({ success: true, audioUrl: 'https://media.example.com/generated.mp3', cached: true })
})
afterEach(() => jest.restoreAllMocks())

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
