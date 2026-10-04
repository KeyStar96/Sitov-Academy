import React from 'react'
import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import ExamSimulationTeacher from '@/components/exam-simulation/ExamSimulationTeacher'
import {getSimulationTeacherState,grantSimulationFeature,grantSimulationLevel,reviewExamSimulationTask,resetStudentSimulationProgress,sitovAssignSimulationStudent} from '@/app/actions/exam-simulation'
import type {SimulationTeacherState} from '@/lib/exam-simulation/server'
import type {SimulationSession,SimulationTask} from '@/lib/exam-simulation/types'
jest.unmock('lucide-react')
jest.mock('@/app/actions/exam-simulation',()=>({getSimulationTeacherState:jest.fn(),reviewExamSimulationTask:jest.fn(),grantSimulationLevel:jest.fn(),grantSimulationFeature:jest.fn(),resetStudentSimulationProgress:jest.fn(),sitovAssignSimulationStudent:jest.fn()}))
jest.mock('@/app/actions/exam-preparation',()=>({assignExamTeacher:jest.fn()}))
jest.mock('@/components/exam-simulation/ExamSimulation',()=>({FeedbackCard:({feedback}:{feedback:{title:string;answerText?:string|string[]}})=><div>{feedback.title}<span>{feedback.answerText}</span></div>}))
const task:SimulationTask={id:'sitov-speaking',version:1,level:'B1',skill:'speaking',family:'speaking-opinion',type:'speaking',title:'Eine Meinung vorstellen',instruction:'Stellen Sie Ihre Meinung vor.',maxPoints:20,minutes:3,criteria:['Verständliche Gründe nennen']}
function state(audioUrl?:string):SimulationTeacherState{
 const session:SimulationSession={id:'00000000-0000-4000-8000-000000000001',version:1,profileId:'telc_b1',level:'B1',provider:'telc',mode:'practice',title:'Historischer Durchgang',startedAt:'2026-10-04T10:00:00Z',expiresAt:'2026-10-04T11:00:00Z',completedAt:'2026-10-04T10:30:00Z',status:'completed',tasks:[task],answers:{[task.id]:{text:'Meine Notizen',audioPath:'student/speaking/own.webm',...(audioUrl?{audioUrl}:{})}},coverage:{included:[task.family],missing:[],fullExam:false,note:''}}
 return {success:true,actorRole:'teacher',runs:[{studentId:'student',studentName:'Max',session}],students:[{id:'student',name:'Max'}],assignments:[],teachers:[],levelGrants:[],featureGrants:[]}
}
function mountReview(initial=state(),preview=false){const result=render(<ExamSimulationTeacher initial={initial} lang="de" preview={preview}/>);fireEvent.click(screen.getByRole('button',{name:'Antworten bewerten'}));return result}
function fill(){fireEvent.change(screen.getByLabelText('Punkte (0 bis 20)'),{target:{value:'16'}});fireEvent.change(screen.getByLabelText('Stärken und nächster Übungsschritt'),{target:{value:'Gute Gründe, noch klarer gliedern.'}})}
beforeAll(()=>Object.defineProperty(globalThis.crypto,'randomUUID',{configurable:true,value:()=> '00000000-0000-4000-8000-000000000003'}))
beforeEach(()=>jest.clearAllMocks())
it('does not permit a speaking score without an available private recording',()=>{
 mountReview(state());fill()
 expect(screen.getByText('1 offene Bewertung')).toBeInTheDocument()
 expect(screen.getByRole('alert')).toHaveTextContent('Aufnahme ist gerade nicht verfügbar')
 expect(screen.getByRole('button',{name:'Bewertung speichern'})).toBeDisabled()
 expect(reviewExamSimulationTask).not.toHaveBeenCalled()
})
it('a failed recording playback blocks grading even when its signed URL exists',()=>{
 mountReview(state('https://private.test/audio.webm'));fill()
 const player=screen.getByLabelText('Private Sprechaufnahme anhören')
 expect(screen.getByRole('button',{name:'Bewertung speichern'})).toBeEnabled()
 fireEvent.error(player)
 expect(screen.getByRole('button',{name:'Bewertung speichern'})).toBeDisabled()
 expect(screen.getByRole('alert')).toHaveTextContent('bevor du diese Sprechleistung bewertest')
 fireEvent.canPlay(player)
 expect(screen.getByRole('button',{name:'Bewertung speichern'})).toBeEnabled()
})
it('manual refresh clears the previous score and feedback before another learner is selected',async()=>{
 const next=state('https://private.test/next.webm');next.runs[0].studentName='Daniel';next.runs[0].session.id='00000000-0000-4000-8000-000000000002'
 jest.mocked(getSimulationTeacherState).mockResolvedValue(next)
 mountReview(state('https://private.test/audio.webm'));fill()
 fireEvent.click(screen.getByRole('button',{name:'Aktualisieren'}))
 await waitFor(()=>expect(screen.getByText('Antwort von Daniel')).toBeInTheDocument())
 expect(screen.getByLabelText('Punkte (0 bis 20)')).toHaveValue(null)
 expect(screen.getByLabelText('Stärken und nächster Übungsschritt')).toHaveValue('')
 expect(screen.getByRole('button',{name:'Bewertung speichern'})).toBeDisabled()
 expect(reviewExamSimulationTask).not.toHaveBeenCalled()
})
it('scripts without a real pupil recording never enter the speaking review queue',()=>{
 const initial=state();initial.runs[0].session.answers[task.id]={text:'Nur ein Skript'}
 mountReview(initial)
 expect(screen.getByText('0 offene Bewertungen')).toBeInTheDocument()
 expect(screen.queryByRole('button',{name:'Bewertung speichern'})).not.toBeInTheDocument()
})
it('allows zero points for a missing dialogue but requires explicit interaction confirmation for positive points',async()=>{
 const initial=state('https://private.test/audio.webm')
 initial.runs[0].session.tasks=[{...task,interactionRequired:true}]
 jest.mocked(reviewExamSimulationTask).mockResolvedValue({success:false,error:'Testantwort bleibt zur Prüfung offen.'})
 mountReview(initial);fill()
 const save=screen.getByRole('button',{name:'Bewertung speichern'})
 expect(save).toBeDisabled()
 fireEvent.change(screen.getByLabelText('Punkte (0 bis 20)'),{target:{value:'0'}})
 expect(save).toBeEnabled()
 fireEvent.change(screen.getByLabelText('Punkte (0 bis 20)'),{target:{value:'16'}})
 expect(save).toBeDisabled()
 fireEvent.click(screen.getByLabelText(/Ich habe eine tatsächliche Gesprächsleistung geprüft/))
 expect(save).toBeEnabled();fireEvent.click(save)
 await waitFor(()=>expect(reviewExamSimulationTask).toHaveBeenCalledWith(expect.objectContaining({score:16,interactionConfirmed:true,taskId:task.id})))
})

it('keeps the feature gate closed before separate advanced level controls',()=>{
 render(<ExamSimulationTeacher initial={state()} lang="ru"/> )
 expect(screen.getByRole('button',{name:'Freigaben'})).toHaveAttribute('aria-pressed','true')
 expect(screen.getByText('Max: Prüfung gesperrt')).toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Prüfung für Max freigeben'})).toBeEnabled()
 expect(screen.getByRole('button',{name:'B2 freigeben'})).toBeDisabled()
 expect(grantSimulationFeature).not.toHaveBeenCalled()
})
it('grants and revokes only the selected learner through an authoritative refresh',async()=>{
 const enabled=state();enabled.featureGrants=[{studentId:'student'}]
 jest.mocked(grantSimulationFeature).mockResolvedValue({success:true})
 jest.mocked(getSimulationTeacherState).mockResolvedValueOnce(enabled).mockResolvedValueOnce(state())
 render(<ExamSimulationTeacher initial={state()} lang="de"/> )
 fireEvent.click(screen.getByRole('button',{name:'Prüfung für Max freigeben'}))
 await waitFor(()=>expect(screen.getByText('Max: Prüfung freigegeben')).toBeInTheDocument())
 expect(grantSimulationFeature).toHaveBeenNthCalledWith(1,{studentId:'student',enabled:true})
 expect(screen.getByRole('button',{name:'B2 freigeben'})).toBeEnabled()
 fireEvent.click(screen.getByRole('button',{name:'Prüfung für Max sperren'}))
 await waitFor(()=>expect(screen.getByText('Max: Prüfung gesperrt')).toBeInTheDocument())
 expect(grantSimulationFeature).toHaveBeenNthCalledWith(2,{studentId:'student',enabled:false})
})
it('retains a closed gate after a rejected feature write and shows no optimistic unlock',async()=>{
 jest.mocked(grantSimulationFeature).mockResolvedValue({success:false,error:'Nicht zugeordnet.'})
 render(<ExamSimulationTeacher initial={state()} lang="de"/> )
 fireEvent.click(screen.getByRole('button',{name:'Prüfung für Max freigeben'}))
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Nicht zugeordnet.'))
 expect(screen.getByText('Max: Prüfung gesperrt')).toBeInTheDocument()
 expect(getSimulationTeacherState).not.toHaveBeenCalled()
})
it('a teacher with no assigned pupils has no grant or level controls',()=>{
 const empty=state();empty.students=[];empty.runs=[]
 render(<ExamSimulationTeacher initial={empty} lang="de"/> )
 expect(screen.getByText(/Dir sind noch keine Lernenden zugeordnet/)).toBeInTheDocument()
 expect(screen.queryByRole('button',{name:/Prüfung für/})).not.toBeInTheDocument()
 expect(grantSimulationFeature).not.toHaveBeenCalled()
})
it('lets teachers find and take over an unassigned learner even when their assigned list is empty',async()=>{
 const initial=state();initial.students=[];initial.runs=[];initial.unassignedStudents=[{id:'max-id',name:'Max'},{id:'daniel-id',name:'Daniel'}]
 const next=state();next.students=[{id:'daniel-id',name:'Daniel'}];next.runs=[];next.featureGrants=[{studentId:'daniel-id'}];next.unassignedStudents=[{id:'max-id',name:'Max'}]
 jest.mocked(sitovAssignSimulationStudent).mockResolvedValue({success:true})
 jest.mocked(getSimulationTeacherState).mockResolvedValue(next)
 render(<ExamSimulationTeacher initial={initial} lang="de"/> )
 expect(screen.getByText(/übernimm die Prüfungsbetreuung direkt/)).toBeInTheDocument()
 fireEvent.change(screen.getByLabelText('Lernende suchen'),{target:{value:'DAN'}})
 expect(screen.getByLabelText('Teilnehmender ohne Prüfungslehrkraft')).toHaveValue('daniel-id')
 fireEvent.click(screen.getByRole('button',{name:'Übernehmen und für Daniel freigeben'}))
 await waitFor(()=>expect(screen.getByText('Daniel: Prüfung freigegeben')).toBeInTheDocument())
 expect(sitovAssignSimulationStudent).toHaveBeenCalledWith({studentId:'daniel-id'})
 expect(screen.getByLabelText('Teilnehmender für die Prüfung')).toHaveValue('daniel-id')
 expect(grantSimulationFeature).not.toHaveBeenCalled()
})
it('keeps a conflicting assignment closed and offers an authoritative access refresh',async()=>{
 const initial=state();initial.unassignedStudents=[{id:'daniel-id',name:'Daniel'}]
 jest.mocked(sitovAssignSimulationStudent).mockResolvedValue({success:false,error:'Dieser Lernende wurde bereits einer anderen Lehrkraft zugeordnet.'})
 const refreshed=state();refreshed.unassignedStudents=[]
 jest.mocked(getSimulationTeacherState).mockResolvedValue(refreshed)
 render(<ExamSimulationTeacher initial={initial} lang="de"/> )
 fireEvent.click(screen.getByRole('button',{name:'Übernehmen und für Daniel freigeben'}))
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('anderen Lehrkraft'))
 expect(screen.queryByText('Daniel: Prüfung freigegeben')).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Aktualisieren'}))
 await waitFor(()=>expect(screen.queryByLabelText('Lernende suchen')).not.toBeInTheDocument())
 expect(screen.getByText('Max: Prüfung gesperrt')).toBeInTheDocument()
})
it('keeps candidate assignment disabled in preview and handles a search without matches',()=>{
 const initial=state();initial.unassignedStudents=[{id:'daniel-id',name:'Daniel'}]
 render(<ExamSimulationTeacher initial={initial} lang="de" preview/> )
 expect(screen.getByRole('button',{name:'Übernehmen und für Daniel freigeben'})).toBeDisabled()
 fireEvent.change(screen.getByLabelText('Lernende suchen'),{target:{value:'Nicht vorhanden'}})
 expect(screen.getByText('Keine Lernenden mit diesem Namen gefunden.')).toBeInTheDocument()
 expect(sitovAssignSimulationStudent).not.toHaveBeenCalled()
})
it('displays all completed answers separately and masks partial productive percentages while pending',()=>{
 const initial=state();initial.runs[0].session.result={status:'teacher-review-required',headline:'Bewertung offen',description:'Die Lehrkraft prüft die Leistungen.',examPass:null,percentage:null,reviewedPoints:10,reviewedMaxPoints:10,totalMaxPoints:20,pendingTeacherTasks:1,missingSkills:[],skills:[{skill:'writing',title:'Schreiben',points:10,maxPoints:20,percentage:100,pendingTeacherTasks:1,correctTasks:1,wrongTasks:0}],feedback:[{taskId:task.id,title:'Gespeicherte Antwort',skill:'speaking',family:task.family,answer:'Meine Antwort',answerText:'Meine Antwort',correct:null,points:null,maxPoints:20,explanation:'Fachliche Bewertung steht aus.'}],nextSteps:[]}
 render(<ExamSimulationTeacher initial={initial} lang="de"/> )
 fireEvent.click(screen.getByRole('button',{name:'Ergebnisse'}))
 expect(screen.getAllByText('Bewertung offen')).toHaveLength(2)
 expect(screen.queryByText('100 %')).not.toBeInTheDocument()
 expect(screen.getByText('1 Leistung wartet auf eine fachliche Bewertung.')).toBeInTheDocument()
 expect(screen.getByText('1 Bewertung offen')).toBeInTheDocument()
 expect(screen.getByText('Meine Antwort')).toBeInTheDocument()
 expect(screen.getByLabelText('Ergebnis auswählen')).toBeInTheDocument()
})
it('safe teacher preview prevents all feature and grading writes',()=>{
 render(<ExamSimulationTeacher initial={state('https://private.test/audio.webm')} lang="de" preview/> )
 expect(screen.getByRole('button',{name:'Prüfung für Max freigeben'})).toBeDisabled()
 fireEvent.click(screen.getByRole('button',{name:'Antworten bewerten'}));fill()
 expect(screen.getByRole('button',{name:'Bewertung speichern'})).toBeDisabled()
 expect(screen.getByRole('button',{name:'Aktualisieren'})).toBeDisabled()
 expect(grantSimulationFeature).not.toHaveBeenCalled()
 expect(grantSimulationLevel).not.toHaveBeenCalled()
 expect(reviewExamSimulationTask).not.toHaveBeenCalled()
})

it('requires two steps and the exact selected name before a complete exam-only reset',()=>{
 render(<ExamSimulationTeacher initial={state()} lang="de"/> )
 expect(screen.getByText('Alle laufenden und abgeschlossenen Prüfungsdurchgänge')).toBeInTheDocument()
 expect(screen.getByText('Alle Antworten, Ergebnisse und Lehrkraftbewertungen')).toBeInTheDocument()
 expect(screen.getByText(/Die persönliche Prüfungsfreigabe, Niveaurechte und alle anderen Trainer bleiben erhalten/)).toBeInTheDocument()
 expect(screen.queryByRole('button',{name:/endgültig löschen/})).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Reset für Max vorbereiten'}))
 const final=screen.getByRole('button',{name:'Prüfungsfortschritt von Max endgültig löschen'})
 expect(final).toBeDisabled()
 fireEvent.change(screen.getByLabelText('Name zur Reset-Bestätigung'),{target:{value:'Daniel'}})
 expect(final).toBeDisabled()
 fireEvent.change(screen.getByLabelText('Name zur Reset-Bestätigung'),{target:{value:'Max'}})
 expect(final).toBeEnabled()
 fireEvent.click(screen.getByRole('button',{name:'Abbrechen'}))
 expect(resetStudentSimulationProgress).not.toHaveBeenCalled()
 expect(screen.queryByLabelText('Name zur Reset-Bestätigung')).not.toBeInTheDocument()
})
it('keeps the reset receipt id on failure, blocks duplicate actions and refreshes all runs after success',async()=>{
 let finish:(value:{success:boolean;error?:string})=>void=()=>{}
 jest.mocked(resetStudentSimulationProgress).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockResolvedValueOnce({success:true})
 const after=state();after.runs=[];after.featureGrants=[{studentId:'student'}]
 jest.mocked(getSimulationTeacherState).mockResolvedValue(after)
 render(<ExamSimulationTeacher initial={state()} lang="de"/> )
 fireEvent.click(screen.getByRole('button',{name:'Reset für Max vorbereiten'}))
 fireEvent.change(screen.getByLabelText('Name zur Reset-Bestätigung'),{target:{value:'Max'}})
 fireEvent.click(screen.getByRole('button',{name:'Prüfungsfortschritt von Max endgültig löschen'}))
 expect(screen.getByRole('button',{name:'Prüfungsdaten werden gelöscht …'})).toBeDisabled()
 expect(screen.getByLabelText('Teilnehmender für die Prüfung')).toBeDisabled()
 fireEvent.click(screen.getByRole('button',{name:'Prüfungsdaten werden gelöscht …'}))
 expect(resetStudentSimulationProgress).toHaveBeenCalledTimes(1)
 finish({success:false,error:'Bereinigung noch offen.'})
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Bereinigung noch offen.'))
 fireEvent.click(screen.getByRole('button',{name:'Prüfungsfortschritt von Max endgültig löschen'}))
 await waitFor(()=>expect(screen.getByText('Der Prüfungsfortschritt von Max wurde vollständig zurückgesetzt.')).toBeInTheDocument())
 expect(resetStudentSimulationProgress).toHaveBeenNthCalledWith(1,{studentId:'student',requestId:'00000000-0000-4000-8000-000000000003'})
 expect(resetStudentSimulationProgress).toHaveBeenNthCalledWith(2,{studentId:'student',requestId:'00000000-0000-4000-8000-000000000003'})
 expect(getSimulationTeacherState).toHaveBeenCalledTimes(1)
 expect(screen.getByText('Max: Prüfung freigegeben')).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Ergebnisse'}))
 expect(screen.getByText(/Noch keine abgeschlossene Prüfung vorhanden/)).toBeInTheDocument()
})
it('a different selected pupil loses the former reset confirmation and safe preview cannot reset',()=>{
 const initial=state();initial.students.push({id:'second-student',name:'Daniel'})
 render(<ExamSimulationTeacher initial={initial} lang="de"/> )
 fireEvent.click(screen.getByRole('button',{name:'Reset für Max vorbereiten'}))
 fireEvent.change(screen.getByLabelText('Name zur Reset-Bestätigung'),{target:{value:'Max'}})
 fireEvent.change(screen.getByLabelText('Teilnehmender für die Prüfung'),{target:{value:'second-student'}})
 expect(screen.queryByLabelText('Name zur Reset-Bestätigung')).not.toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Reset für Daniel vorbereiten'})).toBeInTheDocument()
 expect(resetStudentSimulationProgress).not.toHaveBeenCalled()
})
it('the development teacher preview never allows a reset preparation',()=>{
 render(<ExamSimulationTeacher initial={state()} lang="de" preview/> )
 expect(screen.getByRole('button',{name:'Reset für Max vorbereiten'})).toBeDisabled()
 expect(resetStudentSimulationProgress).not.toHaveBeenCalled()
})
