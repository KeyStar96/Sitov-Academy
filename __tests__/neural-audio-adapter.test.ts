jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('ws', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((url: URL, options: unknown) => mockSocketFactory(url, options)),
}))
jest.mock('node-edge-tts/dist/drm', () => ({
  CHROMIUM_FULL_VERSION: '140.0.0.0', TRUSTED_CLIENT_TOKEN: 'test-token', generateSecMsGecToken: () => 'test-gec',
}))

import { EventEmitter } from 'node:events'
import { synthesizeNeuralAudio } from '@/lib/audio/edge-tts'
import { AUDIO_MAX_BYTES, AUDIO_FORMAT, AUDIO_RATE } from '@/lib/audio/neural-config'

class FakeSocket extends EventEmitter {
  send = jest.fn()
  terminate = jest.fn(() => { this.emit('close') })
}
const mockSocketFactory = jest.fn((_url: URL, _options: unknown) => new FakeSocket())

function start(text = 'Hallo', language: Parameters<typeof synthesizeNeuralAudio>[1] = 'de') {
  const promise = synthesizeNeuralAudio(text, language)
  const socket = mockSocketFactory.mock.results.at(-1)?.value as FakeSocket
  return { socket, promise }
}
function mp3(length = 128) {
  const result = Buffer.alloc(length, 1)
  result.write('ID3', 0, 'ascii')
  return result
}
function frame(bytes: Buffer, path = 'audio') {
  const header = Buffer.from(`Path:${path}\r\nContent-Type:audio/mpeg\r\n`)
  const prefix = Buffer.alloc(2)
  prefix.writeUInt16BE(header.length)
  return Buffer.concat([prefix, header, bytes])
}
function end(socket: FakeSocket) {
  socket.emit('message', Buffer.from('X-RequestId:test\r\nPath:turn.end\r\n\r\n'), false)
}
beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers() })
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers() })

it('bounds the handshake and payload and sends escaped SSML using the chosen voice', async () => {
  const { socket, promise } = start('<Hallo> & "Tür" \'offen\'', 'tr')
  const [url, options] = mockSocketFactory.mock.calls[0]
  expect(url.protocol).toBe('wss:')
  expect(url.hostname).toBe('speech.platform.bing.com')
  expect(url.searchParams.get('Sec-MS-GEC')).toBe('test-gec')
  expect(options).toMatchObject({ handshakeTimeout: 8000, maxPayload: AUDIO_MAX_BYTES })
  socket.emit('open')
  expect(socket.send).toHaveBeenCalledTimes(2)
  const config = socket.send.mock.calls[0][0] as string
  const ssml = socket.send.mock.calls[1][0] as string
  expect(config).toContain(AUDIO_FORMAT)
  expect(ssml).toContain('xml:lang="tr-TR"')
  expect(ssml).toContain('name="tr-TR-EmelNeural"')
  expect(ssml).toContain(`rate="${AUDIO_RATE}"`)
  expect(ssml).toContain('&lt;Hallo&gt; &amp; &quot;Tür&quot; &apos;offen&apos;')
  expect(ssml).not.toContain('<Hallo>')
  socket.emit('message', frame(mp3()), true); end(socket)
  await expect(promise).resolves.toEqual(mp3())
  expect(socket.terminate).toHaveBeenCalledTimes(1)
  expect(jest.getTimerCount()).toBe(0)
})

it('assembles binary chunks without retaining headers or metadata and handles buffer arrays', async () => {
  const { socket, promise } = start()
  const audio = mp3(240)
  socket.emit('message', frame(Buffer.from('ignore'), 'metadata'), true)
  const first = frame(audio.subarray(0, 120))
  socket.emit('message', [first.subarray(0, 6), first.subarray(6)], true)
  socket.emit('message', frame(audio.subarray(120)), true)
  end(socket)
  await expect(promise).resolves.toEqual(audio)
})

it('accepts a raw MPEG sync header as well as ID3', async () => {
  const { socket, promise } = start()
  const audio = Buffer.alloc(128, 0)
  audio[0] = 0xff; audio[1] = 0xfb
  socket.emit('message', frame(audio), true); end(socket)
  await expect(promise).resolves.toEqual(audio)
})

it.each([
  { name: 'missing header length', data: Buffer.from([1]) },
  { name: 'truncated header', data: Buffer.from([0, 12, 3]) },
])('rejects $name and closes the socket immediately', async ({ data }) => {
  const { socket, promise } = start()
  const rejected = expect(promise).rejects.toThrow('Invalid audio frame')
  socket.emit('message', data, true)
  await rejected
  expect(socket.terminate).toHaveBeenCalledTimes(1)
  expect(jest.getTimerCount()).toBe(0)
})

it.each([
  { name: 'empty audio', data: Buffer.alloc(0) },
  { name: 'too-short MP3', data: mp3(99) },
  { name: 'non-MP3 data', data: Buffer.alloc(128) },
])('rejects completion containing $name', async ({ data }) => {
  const { socket, promise } = start()
  const rejected = expect(promise).rejects.toThrow('Invalid MP3 response')
  socket.emit('message', frame(data), true); end(socket)
  await rejected
  expect(socket.terminate).toHaveBeenCalledTimes(1)
})

it('enforces the aggregate byte limit even when every individual frame is below it', async () => {
  const { socket, promise } = start()
  const rejected = expect(promise).rejects.toThrow('Audio response exceeded the cache limit')
  socket.emit('message', frame(mp3(AUDIO_MAX_BYTES / 2)), true)
  socket.emit('message', frame(Buffer.alloc(AUDIO_MAX_BYTES / 2 + 1)), true)
  await rejected
  expect(socket.terminate).toHaveBeenCalledTimes(1)
  expect(jest.getTimerCount()).toBe(0)
})

it('times out a stalled provider and closes the connection exactly once', async () => {
  const { socket, promise } = start()
  const rejected = expect(promise).rejects.toThrow('Audio synthesis timed out')
  jest.advanceTimersByTime(15_000)
  await rejected
  expect(socket.terminate).toHaveBeenCalledTimes(1)
  socket.emit('message', frame(mp3()), true); end(socket)
  expect(socket.terminate).toHaveBeenCalledTimes(1)
  expect(jest.getTimerCount()).toBe(0)
})

it('rejects provider close before the completion marker even after valid partial audio', async () => {
  const { socket, promise } = start()
  const rejected = expect(promise).rejects.toThrow('Audio provider closed before completion')
  socket.emit('message', frame(mp3()), true); socket.emit('close')
  await rejected
  expect(socket.terminate).toHaveBeenCalledTimes(1)
  expect(jest.getTimerCount()).toBe(0)
})

it('handles transport/handshake errors without disclosing their raw diagnostic', async () => {
  const { socket, promise } = start()
  const rejected = expect(promise).rejects.toThrow('Audio provider connection failed')
  socket.emit('error', new Error('private provider diagnostic'))
  await rejected
  expect(socket.terminate).toHaveBeenCalledTimes(1)
  expect(jest.getTimerCount()).toBe(0)
})
