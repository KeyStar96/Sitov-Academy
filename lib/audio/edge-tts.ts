import 'server-only'

import { randomBytes } from 'node:crypto'
import WebSocket from 'ws'
import { CHROMIUM_FULL_VERSION, TRUSTED_CLIENT_TOKEN, generateSecMsGecToken } from 'node-edge-tts/dist/drm'
import { AUDIO_FORMAT, AUDIO_MAX_BYTES, AUDIO_RATE, NEURAL_VOICES } from './neural-config'
import type { NeuralAudioLanguage } from '@/lib/types/audio'

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character] ?? character)
}

/**
 * Edge protocol/token support comes from the pinned MIT node-edge-tts package.
 * Own the stream so every failure closes the socket, bounds memory and needs no filesystem/Python.
 */
export function synthesizeNeuralAudio(text: string, language: NeuralAudioLanguage): Promise<Buffer> {
  const { voice, locale } = NEURAL_VOICES[language]
  const endpoint = new URL('wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1')
  endpoint.searchParams.set('TrustedClientToken', TRUSTED_CLIENT_TOKEN)
  endpoint.searchParams.set('Sec-MS-GEC', generateSecMsGecToken())
  endpoint.searchParams.set('Sec-MS-GEC-Version', `1-${CHROMIUM_FULL_VERSION}`)

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint, {
      handshakeTimeout: 8_000,
      maxPayload: AUDIO_MAX_BYTES,
      origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
      headers: {
        'Pragma': 'no-cache', 'Cache-Control': 'no-cache',
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0 Safari/537.36 Edg/${CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0`,
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    let settled = false
    let byteLength = 0
    const chunks: Buffer[] = []
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.terminate()
      if (error) { reject(error); return }
      const audio = Buffer.concat(chunks, byteLength)
      const mp3 = audio.subarray(0, 3).toString('ascii') === 'ID3' || (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0)
      if (!mp3 || byteLength < 100) { reject(new Error('Invalid MP3 response')); return }
      resolve(audio)
    }
    const timer = setTimeout(() => finish(new Error('Audio synthesis timed out')), 15_000)
    socket.on('error', () => finish(new Error('Audio provider connection failed')))
    socket.on('close', () => finish(new Error('Audio provider closed before completion')))
    socket.on('open', () => {
      const configuration = { context: { synthesis: { audio: { metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' }, outputFormat: AUDIO_FORMAT } } } }
      socket.send(`Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${JSON.stringify(configuration)}`)
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale}"><voice name="${voice}"><prosody rate="${AUDIO_RATE}" pitch="default" volume="default">${escapeXml(text)}</prosody></voice></speak>`
      socket.send(`X-RequestId:${randomBytes(16).toString('hex')}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`)
    })
    socket.on('message', (raw, isBinary) => {
      if (settled) return
      const data = Array.isArray(raw) ? Buffer.concat(raw) : Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
      if (!isBinary) {
        if (/^Path:turn\.end\r?$/m.test(data.toString('utf8'))) finish()
        return
      }
      if (data.length < 2) { finish(new Error('Invalid audio frame')); return }
      const headerLength = data.readUInt16BE(0)
      if (headerLength + 2 > data.length) { finish(new Error('Invalid audio frame')); return }
      const header = data.subarray(2, headerLength + 2).toString('utf8')
      if (!/^Path:audio\r?$/m.test(header)) return
      const chunk = data.subarray(headerLength + 2)
      byteLength += chunk.length
      if (byteLength > AUDIO_MAX_BYTES) { finish(new Error('Audio response exceeded the cache limit')); return }
      chunks.push(chunk)
    })
  })
}
