import React,{useState} from 'react'
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react'
import SimulationRecording from '@/components/exam-simulation/SimulationRecording'
import type {SimulationAnswer} from '@/lib/exam-simulation/types'
import {createSimulationUpload} from '@/app/actions/exam-simulation'
import {createClient} from '@/utils/supabase/client'
import {useAudioRecorder} from '@/lib/audio/useAudioRecorder'
import {SITOV_SIMULATION_UI_LANGUAGES,sitovSimulationCopy} from '@/lib/exam-simulation/ui-copy'
jest.unmock('lucide-react')
jest.mock('@/app/actions/exam-simulation',()=>({createSimulationUpload:jest.fn()}))
jest.mock('@/utils/supabase/client',()=>({createClient:jest.fn()}))
jest.mock('@/lib/audio/useAudioRecorder',()=>({useAudioRecorder:jest.fn()}))
jest.mock('@/components/audio/LiveWaveform',()=>({__esModule:true,default:()=>null}))
const oldPath='student/speaking/old.webm',newPath='student/speaking/new.webm'
const uploaded=jest.fn(),busy=jest.fn(),change=jest.fn()
function Harness({preview=false,disabled=false}:{preview?:boolean;disabled?:boolean}){
 const [answer,setAnswer]=useState<SimulationAnswer>({text:'Meine ursprünglichen Notizen',audioPath:oldPath,audioUrl:'https://private.test/old.webm'})
 return <><SimulationRecording runId="00000000-0000-4000-8000-000000000001" taskId="sitov-speaking" value={answer} preview={preview} disabled={disabled} onBusy={busy} onChange={value=>{change(value);setAnswer(value)}}/><output aria-label="Aktuelle gespeicherte Antwort">{JSON.stringify(answer)}</output></>
}
function choose(type='audio/webm',sizeText='new recording'){
 fireEvent.change(screen.getByLabelText('Audiodatei bis 20 MB'),{target:{files:[new File([sizeText],'recording.webm',{type})]}})
}
beforeEach(()=>{
 jest.clearAllMocks()
 Object.defineProperty(URL,'createObjectURL',{value:jest.fn(()=> 'blob:local-recording'),configurable:true})
 Object.defineProperty(URL,'revokeObjectURL',{value:jest.fn(),configurable:true})
 jest.mocked(useAudioRecorder).mockReturnValue({status:'idle',levels:[],elapsedSeconds:0,audioUrl:null,audioBlob:null,isRecording:false,hasRecording:false,analyserRef:{current:null},start:jest.fn(async()=>{}),stop:jest.fn(),reset:jest.fn()})
 jest.mocked(createSimulationUpload).mockResolvedValue({success:true,path:newPath,token:'private-upload-token',bucket:'sitov-exam-submissions'})
 uploaded.mockResolvedValue({error:null})
 jest.mocked(createClient).mockReturnValue({storage:{from:jest.fn(()=>({uploadToSignedUrl:uploaded}))}} as unknown as ReturnType<typeof createClient>)
})
it('selecting a replacement never uploads or overwrites the persisted recording before deliberate use',()=>{
 render(<Harness/>);choose()
 expect(createSimulationUpload).not.toHaveBeenCalled();expect(uploaded).not.toHaveBeenCalled()
 expect(screen.getByLabelText('Aktuelle gespeicherte Antwort')).toHaveTextContent(oldPath)
 expect(change).not.toHaveBeenCalled()
})
it('discarding an unused replacement restores navigation and retains the original submitted media',()=>{
 render(<Harness/>);choose()
 expect(busy).toHaveBeenCalledWith(true)
 fireEvent.click(screen.getByRole('button',{name:'Neue Aufnahme verwerfen'}))
 expect(screen.getByLabelText('Aktuelle gespeicherte Antwort')).toHaveTextContent(oldPath)
 expect(change).not.toHaveBeenCalled();expect(createSimulationUpload).not.toHaveBeenCalled()
 expect(screen.queryByRole('button',{name:'Diese Aufnahme verwenden'})).not.toBeInTheDocument()
 expect(busy).toHaveBeenLastCalledWith(false)
})
it('a failed upload keeps the original answer and the local file available for retry',async()=>{
 uploaded.mockResolvedValue({error:{message:'network unavailable'}})
 render(<Harness/>);choose();fireEvent.click(screen.getByRole('button',{name:'Diese Aufnahme verwenden'}))
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Sie bleibt hier'))
 expect(screen.getByLabelText('Aktuelle gespeicherte Antwort')).toHaveTextContent(oldPath)
 expect(change).not.toHaveBeenCalled()
 expect(screen.getByRole('button',{name:'Diese Aufnahme verwenden'})).toBeEnabled()
})
it('expiry rejection retains the old answer and does not send the file to Storage',async()=>{
 jest.mocked(createSimulationUpload).mockResolvedValue({success:false,error:'Die Prüfungszeit ist beendet.'})
 render(<Harness/>);choose();fireEvent.click(screen.getByRole('button',{name:'Diese Aufnahme verwenden'}))
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Prüfungszeit ist beendet'))
 expect(uploaded).not.toHaveBeenCalled();expect(change).not.toHaveBeenCalled()
 expect(screen.getByLabelText('Aktuelle gespeicherte Antwort')).toHaveTextContent(oldPath)
})
it('deliberate successful upload changes only the chosen media and preserves the notes',async()=>{
 render(<Harness/>);choose();fireEvent.click(screen.getByRole('button',{name:'Diese Aufnahme verwenden'}))
 await waitFor(()=>expect(screen.getByLabelText('Aktuelle gespeicherte Antwort')).toHaveTextContent(newPath))
 expect(uploaded).toHaveBeenCalledTimes(1)
 expect(change).toHaveBeenCalledWith({text:'Meine ursprünglichen Notizen',audioPath:newPath})
 expect(screen.getByLabelText('Aktuelle gespeicherte Antwort')).toHaveTextContent('Meine ursprünglichen Notizen')
})
it('an in-flight upload marks the recorder busy to prevent task navigation',async()=>{
 let resolve!:(value:{error:null})=>void
 uploaded.mockReturnValue(new Promise(done=>{resolve=done}))
 render(<Harness/>);choose();fireEvent.click(screen.getByRole('button',{name:'Diese Aufnahme verwenden'}))
 await waitFor(()=>expect(uploaded).toHaveBeenCalled())
 expect(busy).toHaveBeenCalledWith(true)
 expect(screen.getByRole('button',{name:'Aufnahme wird hochgeladen …'})).toBeDisabled()
 await act(async()=>resolve({error:null}))
})
it('invalid files and previews never issue a private storage upload',()=>{
 const first=render(<Harness/>);choose('image/png')
 expect(screen.getByRole('alert')).toHaveTextContent('Audiodatei');expect(createSimulationUpload).not.toHaveBeenCalled();expect(change).not.toHaveBeenCalled()
 first.unmount();render(<Harness preview/>)
 expect(screen.queryByRole('button',{name:'Aufnahme starten'})).not.toBeInTheDocument()
 expect(screen.queryByLabelText('Audiodatei bis 20 MB')).not.toBeInTheDocument()
 expect(createSimulationUpload).not.toHaveBeenCalled()
})
it('never renders an invalid playback URL when a saved recording cannot be signed',()=>{
 render(<SimulationRecording runId="00000000-0000-4000-8000-000000000001" taskId="sitov-speaking" value={{text:'',audioPath:oldPath,audioUrl:undefined}} preview={false} disabled={false} onBusy={busy} onChange={change}/>)
 expect(screen.queryByLabelText('Eigene Sprechaufnahme anhören')).not.toBeInTheDocument()
 expect(createSimulationUpload).not.toHaveBeenCalled()
 expect(change).not.toHaveBeenCalled()
})
it('keeps a resumed recording playable while editing its optional notes',()=>{
 render(<Harness/>)
 fireEvent.change(screen.getByLabelText('Deine Notizen'),{target:{value:'Überarbeitete Notizen'}})
 expect(screen.getByLabelText('Eigene Sprechaufnahme anhören')).toHaveAttribute('src','https://private.test/old.webm')
 expect(change).toHaveBeenCalledWith({text:'Überarbeitete Notizen',audioPath:oldPath,audioUrl:'https://private.test/old.webm'})
 expect(createSimulationUpload).not.toHaveBeenCalled()
})

it.each(SITOV_SIMULATION_UI_LANGUAGES)('uses %s recording controls and keeps the German notes unchanged',lang=>{
 const copy=sitovSimulationCopy(lang)
 const notes='Meine deutschen Notizen bleiben erhalten.'
 const {container}=render(<SimulationRecording lang={lang} runId="00000000-0000-4000-8000-000000000001" taskId="sitov-speaking" value={{text:notes,audioPath:oldPath,audioUrl:'https://private.test/old.webm'}} preview={false} disabled={false} onBusy={busy} onChange={change}/>)
 expect(container.firstElementChild).toHaveAttribute('lang',lang)
 expect(screen.getByRole('button',{name:copy.t('recordAgain')})).toBeInTheDocument()
 expect(screen.getByLabelText(copy.t('playRecording'))).toHaveAttribute('src','https://private.test/old.webm')
 const input=screen.getByLabelText(copy.t('notes'))
 expect(input).toHaveValue(notes)
 expect(input).toHaveAttribute('lang','de')
 expect(input).toHaveAttribute('translate','no')
 fireEvent.change(screen.getByLabelText(copy.t('audioFile')),{target:{files:[new File(['not audio'],'image.png',{type:'image/png'})]}})
 expect(screen.getByRole('alert')).toHaveTextContent(copy.t('errorFile'))
 expect(change).not.toHaveBeenCalled()
})
