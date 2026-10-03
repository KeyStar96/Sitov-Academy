import { generateAudio } from '@/app/actions/generate-audio'
import { cachedNeuralAudio, prefetchNeuralAudio, resolveNeuralAudio, type NeuralAudioSource } from '@/lib/audio/neural-client'
import type { GenerateAudioResult } from '@/lib/types/audio'

jest.mock('@/app/actions/generate-audio', () => ({ generateAudio: jest.fn() }))

let sequence = 0
let loadedElements: HTMLMediaElement[] = []
const source = (): NeuralAudioSource => ({ text: `das Wort ${++sequence}`, cardId: `card-${sequence}`, language: 'de' })
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
async function flushRequests() { for (let turn = 0; turn < 12; turn += 1) await Promise.resolve() }

beforeEach(() => {
  jest.clearAllMocks()
  loadedElements = []
  jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(function(this: HTMLMediaElement) { loadedElements.push(this) })
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  jest.mocked(generateAudio).mockImplementation(async input => ({ success: true, audioUrl: `https://media.example.com/${encodeURIComponent(input.text)}.mp3`, cached: false }))
})
afterEach(() => jest.restoreAllMocks())

it('deduplicates a foreground tap against bounded current/next prefetch and preloads the MP3 bytes', async () => {
  const request = deferred<GenerateAudioResult>()
  const first = source()
  const second = source()
  const third = source()
  jest.mocked(generateAudio).mockReturnValueOnce(request.promise)
  const cancel = prefetchNeuralAudio([first, second, third])
  const foreground = resolveNeuralAudio(first)
  const repeated = resolveNeuralAudio(first)
  expect(foreground).toBe(repeated)
  expect(generateAudio).toHaveBeenCalledTimes(2)
  request.resolve({ success: true, audioUrl: 'https://media.example.com/prefetched.mp3', cached: false })
  await expect(foreground).resolves.toBe('https://media.example.com/prefetched.mp3')
  await flushRequests()
  expect(cachedNeuralAudio(first)).toBe('https://media.example.com/prefetched.mp3')
  expect(jest.mocked(generateAudio).mock.calls.map(([input]) => input.text)).toEqual([first.text, second.text])
  const players = loadedElements
  expect(players.some(player => player.src === 'https://media.example.com/prefetched.mp3' && player.preload === 'auto')).toBe(true)
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  cancel()
})

it('limits background synthesis to two requests and drops obsolete queued cards after rapid navigation', async () => {
  const firstRequest = deferred<GenerateAudioResult>()
  const secondRequest = deferred<GenerateAudioResult>()
  jest.mocked(generateAudio).mockReturnValueOnce(firstRequest.promise).mockReturnValueOnce(secondRequest.promise)
  const first = [source(), source()]
  const obsolete = [source(), source()]
  const latest = source()
  const cancelFirst = prefetchNeuralAudio(first)
  const cancelObsolete = prefetchNeuralAudio(obsolete)
  cancelFirst()
  cancelObsolete()
  const cancelLatest = prefetchNeuralAudio([latest])
  expect(generateAudio).toHaveBeenCalledTimes(2)
  firstRequest.resolve({ success: true, audioUrl: 'https://media.example.com/old-a.mp3', cached: true })
  secondRequest.resolve({ success: true, audioUrl: 'https://media.example.com/old-b.mp3', cached: true })
  await flushRequests()
  expect(jest.mocked(generateAudio).mock.calls.map(([input]) => input.text)).toEqual([...first.map(item => item.text), latest.text])
  const loadedSources = loadedElements.map(player => player.getAttribute('src')).filter(Boolean)
  expect(loadedSources).not.toContain('https://media.example.com/old-a.mp3')
  expect(loadedSources).not.toContain('https://media.example.com/old-b.mp3')
  cancelLatest()
})

it('silently releases a failed prefetch so an explicit tap can retry successfully', async () => {
  const first = source()
  jest.mocked(generateAudio).mockResolvedValueOnce({ success: false, error: 'audio_unavailable' })
  const cancel = prefetchNeuralAudio([first])
  await flushRequests()
  expect(cachedNeuralAudio(first)).toBeNull()
  await expect(resolveNeuralAudio(first)).resolves.toContain('https://media.example.com/')
  expect(generateAudio).toHaveBeenCalledTimes(2)
  cancel()
})

it('reuses supplied recordings without synthesis and retains at most four native preload sources', async () => {
  for (let pair = 0; pair < 3; pair += 1) {
    const cancel = prefetchNeuralAudio([0, 1].map(offset => ({ ...source(), audioUrl: `https://media.example.com/recording-${pair}-${offset}.mp3` })))
    await flushRequests()
    cancel()
  }
  const players = [...new Set(loadedElements)]
  expect(players.filter(player => player.hasAttribute('src'))).toHaveLength(4)
  expect(generateAudio).not.toHaveBeenCalled()
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
})


it('shares the single male profile for implicit and explicit requests', async () => {
  const implicit = source()
  const explicit = { ...implicit, voice: 'male' as const }
  const [first, second] = await Promise.all([resolveNeuralAudio(implicit), resolveNeuralAudio(explicit)])
  expect(first).toBe(second)
  expect(generateAudio).toHaveBeenCalledTimes(1)
})

it('discards all old generated German URLs and resolves the prepared Qwen cache', async () => {
  const old = { ...source(), audioUrl: 'https://media.example.com/audio_cache/piper-local-v2/de/old.mp3' }
  expect(cachedNeuralAudio(old)).toBeNull()
  await expect(resolveNeuralAudio(old)).resolves.not.toBe(old.audioUrl)
  expect(generateAudio).toHaveBeenCalledTimes(1)
})
