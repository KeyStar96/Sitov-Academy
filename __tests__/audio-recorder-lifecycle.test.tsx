import { act, renderHook, waitFor } from '@testing-library/react'
import { useAudioRecorder } from '@/lib/audio/useAudioRecorder'
import { createAnalyserNode, decodeFromSource, ensureAudioContext, ensureMicContext, requestMicrophoneStream } from '@/lib/audio/web-audio'
jest.mock('@/lib/audio/web-audio', () => ({
 ...jest.requireActual('@/lib/audio/web-audio'), ensureAudioContext:jest.fn(),ensureMicContext:jest.fn(),requestMicrophoneStream:jest.fn(),createAnalyserNode:jest.fn(),decodeFromSource:jest.fn(),
}))
const events:string[]=[]
class FakeRecorder {
 static instances:FakeRecorder[]=[]
 static isTypeSupported=jest.fn(()=>true)
 state:RecordingState='inactive'
 mimeType='audio/webm'
 ondataavailable:((event:{data:Blob})=>void)|null=null
 onstop:(()=>void)|null=null
 onerror:(()=>void)|null=null
 constructor(){FakeRecorder.instances.push(this)}
 start=jest.fn(()=>{events.push('recording');this.state='recording'})
 stop=jest.fn(()=>{this.state='inactive';this.ondataavailable?.({data:new Blob(['real captured bytes'],{type:'audio/webm'})});this.onstop?.()})
}
function stream() {
 const track={stop:jest.fn()}
 const value={getTracks:()=>[track],clone:()=>value}
 return {value:value as unknown as MediaStream,track}
}
function context() {
 const source={connect:jest.fn(),disconnect:jest.fn()}
 const value={state:'suspended',resume:jest.fn(()=>new Promise<void>(()=>{})),createMediaStreamSource:jest.fn(()=>source)}
 return {value:value as unknown as AudioContext,source,resume:value.resume}
}
let audioContext:ReturnType<typeof context>, micContext:ReturnType<typeof context>
beforeEach(()=>{
 jest.clearAllMocks();events.length=0;FakeRecorder.instances=[]
 Object.defineProperty(global,'MediaRecorder',{value:FakeRecorder,configurable:true})
 Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:jest.fn()},configurable:true})
 Object.defineProperty(URL,'createObjectURL',{value:jest.fn(()=>'blob:recording'),configurable:true})
 Object.defineProperty(URL,'revokeObjectURL',{value:jest.fn(),configurable:true})
 audioContext=context();micContext=context()
 jest.mocked(ensureAudioContext).mockReturnValue(audioContext.value)
 jest.mocked(ensureMicContext).mockImplementation(()=>{events.push('mic context');return micContext.value})
 jest.mocked(createAnalyserNode).mockReturnValue({fftSize:2048,disconnect:jest.fn(),getByteTimeDomainData:(buffer:Uint8Array)=>buffer.fill(128)} as unknown as AnalyserNode)
 jest.mocked(decodeFromSource).mockRejectedValue(new Error('Optional decoder unavailable'))
})
it('starts and completes capture while both AudioContext.resume promises remain pending',async()=>{
 const input=stream()
 jest.mocked(requestMicrophoneStream).mockImplementation(async()=>{events.push('permission');return input.value})
 const {result}=renderHook(()=>useAudioRecorder())
 await act(async()=>{await result.current.start()})
 expect(result.current.status).toBe('recording')
 expect(events).toEqual(['permission','recording','mic context'])
 expect(audioContext.resume).toHaveBeenCalledTimes(1);expect(micContext.resume).toHaveBeenCalledTimes(1)
 expect(result.current.analyserRef.current).not.toBeNull()
 await act(async()=>{result.current.stop()})
 await waitFor(()=>expect(result.current.status).toBe('ready'))
 expect(result.current.audioBlob?.size).toBeGreaterThan(0)
 expect(input.track.stop).toHaveBeenCalled()
})
it('records successfully when optional waveform context creation fails',async()=>{
 jest.mocked(requestMicrophoneStream).mockResolvedValue(stream().value)
 jest.mocked(ensureMicContext).mockImplementation(()=>{throw new Error('Web Audio unavailable')})
 const {result}=renderHook(()=>useAudioRecorder())
 await act(async()=>{await result.current.start()})
 expect(result.current.status).toBe('recording')
 expect(FakeRecorder.instances[0].start).toHaveBeenCalledTimes(1)
 expect(result.current.analyserRef.current).toBeNull()
})
it('releases a microphone granted after the recorder has unmounted and never starts background capture',async()=>{
 const input=stream();let resolve:(value:MediaStream)=>void=()=>{}
 jest.mocked(requestMicrophoneStream).mockReturnValue(new Promise(onResolve=>{resolve=onResolve}))
 const {result,unmount}=renderHook(()=>useAudioRecorder())
 let pending:Promise<void>|undefined
 act(()=>{pending=result.current.start()})
 expect(result.current.status).toBe('requesting')
 unmount()
 await act(async()=>{resolve(input.value);await pending})
 expect(input.track.stop).toHaveBeenCalledTimes(1)
 expect(FakeRecorder.instances).toHaveLength(0)
})
it('coalesces rapid start clicks while the browser microphone permission is pending',async()=>{
 const input=stream();let resolve:(value:MediaStream)=>void=()=>{}
 jest.mocked(requestMicrophoneStream).mockReturnValue(new Promise(onResolve=>{resolve=onResolve}))
 const {result}=renderHook(()=>useAudioRecorder())
 let pending:Promise<void>|undefined
 act(()=>{pending=result.current.start();void result.current.start()})
 expect(requestMicrophoneStream).toHaveBeenCalledTimes(1)
 await act(async()=>{resolve(input.value);await pending})
 expect(FakeRecorder.instances).toHaveLength(1)
})
