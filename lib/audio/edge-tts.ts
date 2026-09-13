import 'server-only'

import { AUDIO_MAX_BYTES, AUDIO_MAX_TEXT_LENGTH, NEURAL_VOICES, normalizeAudioText } from './neural-config'
import type { NeuralAudioLanguage } from '@/lib/types/audio'

/** Kept under the existing import path; every synthesis request now stays on this VPS. */
export async function synthesizeNeuralAudio(input: string, language: NeuralAudioLanguage): Promise<Buffer> {
  const text = normalizeAudioText(input)
  if (!text || text.length > AUDIO_MAX_TEXT_LENGTH || !Object.hasOwn(NEURAL_VOICES, language)) throw new Error('Invalid synthesis input')
  const endpoint = new URL(process.env.LOCAL_TTS_URL || 'http://127.0.0.1:9070')
  if (endpoint.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) || endpoint.username || endpoint.password || !['', '/'].includes(endpoint.pathname) || endpoint.search || endpoint.hash) {
    throw new Error('Speech service must be local')
  }
  endpoint.pathname = '/synthesize'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 80_000)
  const token = process.env.LOCAL_TTS_TOKEN
  try {
    // A busy local worker can be serving a prefetch from another browser. Waiting
    // here preserves one-click playback instead of asking the learner to try again.
    let response: Response
    for (;;) {
      response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ text, language }), cache: 'no-store', signal: controller.signal, redirect: 'error',
      })
      if (response.status !== 503) break
      const diagnostic: unknown = await response.json().catch(() => null)
      if (!diagnostic || typeof diagnostic !== 'object' || !('error' in diagnostic) || diagnostic.error !== 'busy') break
      await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(wait); reject(new Error('Audio synthesis timed out')) }
        const wait = setTimeout(() => { controller.signal.removeEventListener('abort', abort); resolve() }, 300)
        if (controller.signal.aborted) abort()
        else controller.signal.addEventListener('abort', abort, { once: true })
      })
    }
    if (!response.ok || !response.body || !response.headers.get('Content-Type')?.startsWith('audio/mpeg')) throw new Error('Local speech service unavailable')
    if (Number(response.headers.get('Content-Length')) > AUDIO_MAX_BYTES) { await response.body.cancel(); throw new Error('Audio response exceeded the cache limit') }
    const reader = response.body.getReader()
    let byteLength = 0
    const chunks: Buffer[] = []
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        byteLength += value.byteLength
        if (byteLength > AUDIO_MAX_BYTES) { await reader.cancel(); throw new Error('Audio response exceeded the cache limit') }
        chunks.push(Buffer.from(value))
      }
    } finally { reader.releaseLock() }
    const audio = Buffer.concat(chunks, byteLength)
    const mp3 = audio.subarray(0, 3).toString('ascii') === 'ID3' || (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0)
    if (!mp3 || byteLength < 100) throw new Error('Invalid MP3 response')
    return audio
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Audio synthesis timed out')
    if (error instanceof Error && ['Local speech service unavailable', 'Audio response exceeded the cache limit', 'Invalid MP3 response'].includes(error.message)) throw error
    throw new Error('Local speech service unavailable')
  } finally { clearTimeout(timer) }
}
