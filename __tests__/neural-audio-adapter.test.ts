/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
import { synthesizeNeuralAudio } from '@/lib/audio/edge-tts'
import { AUDIO_MAX_BYTES, AUDIO_MAX_TEXT_LENGTH } from '@/lib/audio/neural-config'
const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
const originalFetch = global.fetch
function mp3(length=128) { const result=Buffer.alloc(length,1); result.write('ID3'); return result }
function audioResponse(audio=mp3()) { return new Response(audio,{headers:{'Content-Type':'audio/mpeg'}}) }
beforeEach(()=>{ global.fetch=fetchMock; fetchMock.mockReset(); delete process.env.LOCAL_TTS_URL; delete process.env.LOCAL_TTS_TOKEN })
afterAll(()=>{global.fetch=originalFetch})

it('sends plaintext and language only to loopback and assembles valid MP3',async()=>{
  fetchMock.mockResolvedValue(audioResponse())
  await expect(synthesizeNeuralAudio('  Guten   Tag.  ','de')).resolves.toEqual(mp3())
  const [url,options]=fetchMock.mock.calls[0]
  expect(String(url)).toBe('http://127.0.0.1:9070/synthesize')
  expect(options).toMatchObject({method:'POST',cache:'no-store',redirect:'error',body:JSON.stringify({text:'Guten Tag.',language:'de'})})
})
it('uses the optional server-only token',async()=>{
  process.env.LOCAL_TTS_TOKEN='local-only'
  fetchMock.mockResolvedValue(audioResponse())
  await synthesizeNeuralAudio('Merhaba','tr')
  expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({Authorization:'Bearer local-only'})
})
it.each(['https://remote.example','http://127.0.0.1@remote.example','http://127.0.0.1/other','http://127.0.0.1?redirect=remote'])('refuses a nonlocal or misleading endpoint %s',async url=>{
  process.env.LOCAL_TTS_URL=url
  await expect(synthesizeNeuralAudio('Hallo','de')).rejects.toThrow('must be local')
  expect(fetchMock).not.toHaveBeenCalled()
})
it('validates text length before doing work',async()=>{
  await expect(synthesizeNeuralAudio(' ','de')).rejects.toThrow('Invalid synthesis input')
  await expect(synthesizeNeuralAudio('x'.repeat(AUDIO_MAX_TEXT_LENGTH+1),'de')).rejects.toThrow('Invalid synthesis input')
  expect(fetchMock).not.toHaveBeenCalled()
})
it('waits for a busy prefetch worker without requiring another user click',async()=>{
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({error:'busy'}),{status:503,headers:{'Content-Type':'application/json'}})).mockResolvedValueOnce(audioResponse())
  await expect(synthesizeNeuralAudio('Hallo','de')).resolves.toEqual(mp3())
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
it('does not retry a real synthesis failure as a busy queue',async()=>{
  fetchMock.mockResolvedValue(new Response(JSON.stringify({error:'synthesis_unavailable'}),{status:503}))
  await expect(synthesizeNeuralAudio('Hallo','de')).rejects.toThrow('Local speech service unavailable')
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
it('rejects misleading content types, truncated data, and excessive response sizes',async()=>{
  fetchMock.mockResolvedValueOnce(new Response('<html>error</html>',{headers:{'Content-Type':'text/html'}}))
  await expect(synthesizeNeuralAudio('Hallo','de')).rejects.toThrow('unavailable')
  fetchMock.mockResolvedValueOnce(audioResponse(Buffer.alloc(128)))
  await expect(synthesizeNeuralAudio('Hallo','de')).rejects.toThrow('Invalid MP3')
  fetchMock.mockResolvedValueOnce(audioResponse(mp3(AUDIO_MAX_BYTES+1)))
  await expect(synthesizeNeuralAudio('Hallo','de')).rejects.toThrow('exceeded')
})
it('returns a safe error when the local service cannot be reached',async()=>{
  fetchMock.mockRejectedValue(new Error('private diagnostic'))
  await expect(synthesizeNeuralAudio('Hallo','de')).rejects.toThrow('Local speech service unavailable')
})
