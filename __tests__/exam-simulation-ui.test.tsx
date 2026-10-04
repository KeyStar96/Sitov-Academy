import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
jest.mock('lucide-react',()=>jest.requireActual('lucide-react'))
jest.mock('@/components/motion/PressableCard',()=>({__esModule:true,default:({children,href,...props}:{children:ReactNode;href?:string}&ComponentProps<'button'>)=>href?<a href={href}>{children}</a>:<button {...props}>{children}</button>}))
jest.mock('@/components/motion/SitovMotionStage',()=>({__esModule:true,default:({children,...props}:ComponentProps<'div'>)=><div {...props}>{children}</div>}))
jest.mock('@/components/exam-simulation/SimulationRecording',()=>({__esModule:true,default:()=> <p>Private Sprechaufnahme</p>}))
jest.mock('@/app/actions/exam-simulation',()=>({startExamSimulation:jest.fn(),saveSimulationAnswer:jest.fn(),finishExamSimulation:jest.fn(),startPreviewExamSimulation:jest.fn(),savePreviewSimulationAnswer:jest.fn(),finishPreviewExamSimulation:jest.fn(),getSimulationState:jest.fn()}))
import * as actions from '@/app/actions/exam-simulation'
import ExamSimulation, { FeedbackCard } from '@/components/exam-simulation/ExamSimulation'
import { SIMULATION_UNIVERSAL_PROFILES } from '@/lib/exam-simulation/catalogue'
import type { SimulationSession, SimulationTask, SimulationState, SimulationResult } from '@/lib/exam-simulation/types'

const readyCatalog=SIMULATION_UNIVERSAL_PROFILES.map(profile=>({...profile,fullExamReleased:true,blockers:[]}))
const empty:SimulationState={available:true,active:null,history:[]}
const task:SimulationTask={id:'sitov-ui-reading',version:1,level:'B1',skill:'reading',family:'reading-detail',type:'choice',title:'Terminänderung verstehen',instruction:'Wähle die passende Antwort.',text:'Der Kurs beginnt am Dienstag um 10 Uhr.',options:[{id:'a',text:'Dienstag um 10 Uhr'},{id:'b',text:'Montag um 9 Uhr'}],maxPoints:1,minutes:1}
const second:SimulationTask={...task,id:'sitov-ui-writing',skill:'writing',family:'writing-formal',type:'writing',title:'Eine Nachricht schreiben',instruction:'Schreibe eine Nachricht.',options:undefined,maxPoints:10,criteria:['Inhalt und Verständlichkeit']}
const session:SimulationSession={id:'00000000-0000-4000-8000-000000000001',version:1,profileId:'sitov_b1',level:'B1',provider:'sitov',mode:'exam',title:'Simulierte Prüfung · B1',startedAt:'2026-10-04T09:00:00Z',expiresAt:'2099-10-04T10:00:00Z',status:'active',tasks:[task,second],answers:{},coverage:{included:['reading-detail','writing-formal'],missing:['listening-detail'],fullExam:false,note:'Dieser Lerncheck enthält noch kein Hören.'}}
const result:SimulationResult={status:'teacher-review-required',headline:'Deine Lehrkraft ergänzt die Bewertung',description:'Geschlossene Aufgaben sind ausgewertet. Die Gesamteinschätzung ist noch offen.',examPass:null,percentage:100,reviewedPoints:1,reviewedMaxPoints:1,totalMaxPoints:11,pendingTeacherTasks:1,missingSkills:['listening'],skills:[{skill:'reading',title:'Lesen',points:1,maxPoints:1,percentage:100,pendingTeacherTasks:0,correctTasks:1,wrongTasks:0},{skill:'writing',title:'Schreiben',points:0,maxPoints:10,percentage:null,pendingTeacherTasks:1,correctTasks:0,wrongTasks:0}],feedback:[{taskId:task.id,title:task.title,skill:task.skill,family:task.family,answer:'a',correct:true,points:1,maxPoints:1,expectedAnswer:'a',explanation:'Dienstag ist der neue Termin.',evidence:'Der Kurs beginnt am Dienstag um 10 Uhr.'},{taskId:second.id,title:second.title,skill:second.skill,family:second.family,answer:{text:'Meine Antwort.'},correct:null,points:null,maxPoints:10,explanation:'Die Lehrkraft prüft diesen Text.',criteria:['Inhalt und Verständlichkeit']}],nextSteps:['Warte auf die Rückmeldung deiner Lehrkraft.']}
beforeEach(()=>{jest.clearAllMocks();window.scrollTo=jest.fn();Object.defineProperty(globalThis.crypto,'randomUUID',{configurable:true,value:()=> '00000000-0000-4000-8000-000000000011'})})

it('offers only level and start, with no institute choice, entirely in German for a Russian UI preference',()=>{
  render(<ExamSimulation lang="ru" initial={empty} catalog={readyCatalog}/>)
  expect(screen.getAllByRole('button',{name:/^(A1|A2|B1|B2|C1|C2) –/})).toHaveLength(6)
  fireEvent.click(screen.getByRole('button',{name:/A1 –/}))
  expect(screen.getByRole('heading',{name:'Deine simulierte Prüfung · A1'})).toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Prüfung starten'})).toBeInTheDocument()
  expect(screen.queryByText(/Goethe|telc|ÖSD/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:/DTZ/})).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:/translate|übersetzen/i})).not.toBeInTheDocument()
})
it('shows the teacher release gate without levels, start or retained run answers while access is locked',()=>{
  render(<ExamSimulation lang="ru" initial={{...empty,available:false,accessLocked:true,active:session}} initialLevel="B1" catalog={readyCatalog}/>)
  expect(screen.getByRole('heading',{name:'Deine Lehrkraft schaltet dich frei'})).toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'Prüfung starten'})).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:/^(A1|A2|B1|B2|C1|C2) –/})).not.toBeInTheDocument()
  expect(screen.queryByRole('heading',{name:task.title})).not.toBeInTheDocument()
  expect(screen.getByRole('link',{name:'Zur Prüfungsvorbereitung'})).toHaveAttribute('href','/ru/dashboard/exam-preparation')
})
it('starts a full universal exam directly from the chosen level',async()=>{
  jest.mocked(actions.startExamSimulation).mockResolvedValue({success:true,session})
  render(<ExamSimulation lang="de" initial={empty} initialLevel="B1" catalog={readyCatalog}/>)
  expect(screen.getByRole('heading',{name:'Deine simulierte Prüfung · B1'})).toBeInTheDocument()
  expect(screen.queryByText('Aktuell: Lerncheck im Prüfungsformat')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Prüfung starten'}))
  await screen.findByRole('heading',{name:task.title})
  expect(actions.startExamSimulation).toHaveBeenCalledWith(expect.objectContaining({level:'B1',provider:'sitov',mode:'exam'}))
})
it('preserves the answer and the same request ID for a failed save, and hides solutions before finalization',async()=>{
  jest.mocked(actions.saveSimulationAnswer).mockResolvedValueOnce({success:false,error:'Verbindung unterbrochen.'}).mockResolvedValueOnce({success:true,session:{...session,answers:{[task.id]:'a'}}})
  render(<ExamSimulation lang="de" initial={{...empty,active:session}} catalog={readyCatalog}/>)
  fireEvent.click(screen.getByRole('radio',{name:/Dienstag um 10 Uhr/}))
  fireEvent.click(screen.getByRole('button',{name:'Speichern & weiter'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Verbindung unterbrochen.')
  expect(screen.getByRole('radio',{name:/Dienstag um 10 Uhr/})).toHaveAttribute('aria-checked','true')
  await waitFor(()=>expect(screen.getByRole('button',{name:'Speichern & weiter'})).toBeEnabled())
  fireEvent.click(screen.getByRole('button',{name:'Speichern & weiter'}))
  await screen.findByRole('heading',{name:second.title})
  const calls=jest.mocked(actions.saveSimulationAnswer).mock.calls
  expect(calls[0][0].requestId).toBe(calls[1][0].requestId)
  expect(screen.queryByText('Passende Lösung')).not.toBeInTheDocument()
  expect(screen.queryByText('Dienstag ist der neue Termin.')).not.toBeInTheDocument()
})
it('supports radio answers with the arrow keys and restores a saved answer when navigating back',async()=>{
  jest.mocked(actions.saveSimulationAnswer).mockImplementation(async input=>({success:true,session:{...session,answers:{...session.answers,[input.taskId]:input.answer}}}))
  render(<ExamSimulation lang="de" initial={{...empty,active:session}} catalog={readyCatalog}/>)
  fireEvent.keyDown(screen.getByRole('radio',{name:/Dienstag/}),{key:'ArrowDown'})
  expect(screen.getByRole('radio',{name:/Montag/})).toHaveAttribute('aria-checked','true')
  fireEvent.click(screen.getByRole('button',{name:'Speichern & weiter'}))
  await screen.findByRole('heading',{name:second.title})
  await waitFor(()=>expect(screen.getByRole('button',{name:'Zurück'})).toBeEnabled())
  fireEvent.click(screen.getByRole('button',{name:'Zurück'}))
  expect(await screen.findByRole('radio',{name:/Montag/})).toHaveAttribute('aria-checked','true')
})
it('requires an explicit finalization and displays right answers, explanations and pending teacher assessment',async()=>{
  const answered={...session,answers:{[task.id]:'a',[second.id]:{text:'Meine Antwort.'}}}
  jest.mocked(actions.finishExamSimulation).mockResolvedValue({success:true,session:{...answered,status:'completed',completedAt:'2026-10-04T10:00:00Z',result}})
  jest.mocked(actions.saveSimulationAnswer).mockResolvedValue({success:true,session:answered})
  render(<ExamSimulation lang="de" initial={{...empty,active:answered}} catalog={readyCatalog}/>)
  fireEvent.click(screen.getByRole('button',{name:'Durchgang beenden'}))
  await screen.findByRole('heading',{name:'Durchgang abschließen?'})
  expect(actions.finishExamSimulation).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Abschließen und auswerten'}))
  await screen.findByRole('heading',{name:result.headline})
  expect(screen.getByText('Bewertung offen')).toBeInTheDocument()
  expect(screen.getByText('Richtig gelöst')).toBeInTheDocument()
  expect(screen.getByText('Passende Lösung')).toBeInTheDocument()
  expect(screen.getByText('Dienstag ist der neue Termin.')).toBeInTheDocument()
  expect(screen.queryByText('Prüfung bestanden')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Lehrkraft (1)'}))
  expect(screen.getByText('Die Lehrkraft prüft diesen Text.')).toBeInTheDocument()
  expect(screen.getByText('Deine Lehrkraft bewertet diese Antwort')).toBeInTheDocument()
})
it('uses only development actions in the explicit preview',async()=>{
  jest.mocked(actions.startPreviewExamSimulation).mockResolvedValue({success:true,session})
  render(<ExamSimulation lang="de" initial={empty} catalog={readyCatalog} initialLevel="B1" preview/>)
  fireEvent.click(screen.getByRole('button',{name:'Prüfung starten'}))
  await screen.findByRole('heading',{name:task.title})
  expect(actions.startExamSimulation).not.toHaveBeenCalled()
  expect(actions.startPreviewExamSimulation).toHaveBeenCalledTimes(1)
})

it('blocks a full start until genuine audio readiness is reported',()=>{
  render(<ExamSimulation lang="de" initial={empty} catalog={SIMULATION_UNIVERSAL_PROFILES} initialLevel="B1"/>)
  expect(screen.getByRole('button',{name:'Prüfung starten'})).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('Diese Prüfung wird noch vorbereitet.')
  expect(actions.startExamSimulation).not.toHaveBeenCalled()
})
it('shows an individual correction for every form field',()=>{
  const form:SimulationTask={...task,type:'form',skill:'writing',family:'writing-form',title:'Anmeldung',options:undefined,fields:[{id:'name',label:'Vorname'},{id:'day',label:'Tag'}],maxPoints:2}
  const evaluated:SimulationResult={...result,pendingTeacherTasks:0,feedback:[{taskId:form.id,title:form.title,skill:form.skill,family:form.family,answer:['Ben','Freitag'],expectedAnswer:['Ben','Montag'],correct:false,points:1,maxPoints:2,explanation:'Der Termin ist Montag.'}]}
  render(<ExamSimulation lang="de" initial={{...empty,active:{...session,status:'completed',tasks:[form],result:evaluated}}} catalog={readyCatalog}/>)
  expect(screen.getByText('Vorname')).toBeInTheDocument()
  expect(screen.getByText('Tag')).toBeInTheDocument()
  expect(screen.getByText('Freitag')).toBeInTheDocument()
  expect(screen.getByText('Montag')).toBeInTheDocument()
  expect(screen.getAllByText('Passende Lösung')).toHaveLength(2)
})
it('loads a completed teacher assessment without starting or losing a run',async()=>{
  const completed={...session,status:'completed' as const,result}
  const assessed={...completed,result:{...result,status:'passed' as const,headline:'Die Sitov-Prüfung bestanden',examPass:true,pendingTeacherTasks:0}}
  jest.mocked(actions.getSimulationState).mockResolvedValue({...empty,history:[assessed]})
  render(<ExamSimulation lang="de" initial={{...empty,active:completed}} catalog={readyCatalog}/>)
  fireEvent.click(screen.getByRole('button',{name:'Bewertungen aktualisieren'}))
  await screen.findByRole('heading',{name:'Die Sitov-Prüfung bestanden'})
  expect(actions.startExamSimulation).not.toHaveBeenCalled()
})

it('shows accepted equivalent clock notation as correct in the field feedback',()=>{
  const form:SimulationTask={...task,type:'form',fields:[{id:'sitov-time',label:'Uhrzeit'}],options:undefined}
  render(<FeedbackCard task={form} feedback={{...result.feedback[0],answer:['08.00 Uhr'],expectedAnswer:['8:00'],correct:true}}/>)
  expect(screen.getAllByText('Richtig')).toHaveLength(1)
  expect(screen.queryByText('Noch üben')).not.toBeInTheDocument()
})

it('compares selected option labels with the readable matching solutions',()=>{
  const matching:SimulationTask={...task,type:'matching',prompts:[{id:'sitov-prompt',text:'Der neue Termin'}]}
  render(<FeedbackCard task={matching} feedback={{...result.feedback[0],answer:['a'],expectedAnswer:['Dienstag um 10 Uhr'],correct:true}}/>)
  expect(screen.getAllByText('Richtig')).toHaveLength(1)
  expect(screen.queryByText('Noch üben')).not.toBeInTheDocument()
})

it('builds a text order only from explicit choices and allows correcting the sequence',()=>{
  const ordered:SimulationTask={...task,type:'ordering',title:'Textteile ordnen',options:[{id:'a',text:'Zuerst planen'},{id:'b',text:'Dann umsetzen'},{id:'c',text:'Zum Schluss prüfen'}]}
  render(<ExamSimulation lang="de" initial={{...empty,active:{...session,tasks:[ordered,second]}}} catalog={readyCatalog}/>)
  expect(screen.getByRole('button',{name:'Speichern & weiter'})).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:/Dann umsetzen/}))
  fireEvent.click(screen.getByRole('button',{name:/Zuerst planen/}))
  expect(screen.getByRole('button',{name:/Zuerst planen/})).toHaveTextContent('2')
  fireEvent.click(screen.getByRole('button',{name:/Dann umsetzen/}))
  expect(screen.getByRole('button',{name:/Zuerst planen/})).toHaveTextContent('1')
  fireEvent.click(screen.getByRole('button',{name:/Dann umsetzen/}))
  fireEvent.click(screen.getByRole('button',{name:/Zum Schluss prüfen/}))
  expect(screen.getByRole('button',{name:'Speichern & weiter'})).toBeEnabled()
})

it('keeps a speaking script without a recording open and does not count it as a performed answer',()=>{
  const oral:SimulationTask={...task,type:'speaking',skill:'speaking',family:'speaking-introduction',title:'Stelle dich vor',options:undefined}
  render(<ExamSimulation lang="de" initial={{...empty,active:{...session,tasks:[oral,second],answers:{[oral.id]:{text:'Meine vorbereiteten Notizen.'}}}}} catalog={readyCatalog}/>)
  expect(screen.getByRole('heading',{name:'Stelle dich vor'})).toBeInTheDocument()
  expect(screen.getByRole('progressbar',{name:'Beantwortete Aufgaben'})).toHaveAttribute('aria-valuenow','0')
  expect(screen.getByRole('button',{name:'Speichern & weiter'})).toBeDisabled()
  expect(screen.getByRole('button',{name:'Ohne Antwort weiter'})).toBeEnabled()
})


it('shows a percentage below the pass threshold without rounding it up',()=>{
  const assessed:SimulationResult={...result,pendingTeacherTasks:0,skills:[{...result.skills[1],percentage:69.5,pendingTeacherTasks:0}]}
  render(<ExamSimulation lang="de" initial={{...empty,active:{...session,status:'completed',result:assessed}}} catalog={readyCatalog}/>)
  expect(screen.getByText('69,5 %')).toBeInTheDocument()
  expect(screen.getByRole('img',{name:'Schreiben: 69,5 Prozent'})).toBeInTheDocument()
  expect(screen.queryByText('70 %')).not.toBeInTheDocument()
})
it('labels a true-false answer in understandable German in the feedback',()=>{
  const decision:SimulationTask={...task,type:'true-false',options:undefined}
  render(<FeedbackCard task={decision} feedback={{...result.feedback[0],answer:'true',expectedAnswer:'Richtig',correct:true}}/>)
  expect(screen.getAllByText('Richtig')).toHaveLength(2)
  expect(screen.queryByText('true')).not.toBeInTheDocument()
})

it('includes the original question in the answer feedback',()=>{
  render(<FeedbackCard task={task} feedback={result.feedback[0]}/>)
  expect(screen.getByText(task.instruction)).toBeInTheDocument()
})

it('does not present a partial automatic writing score as a completed percentage while teacher assessment is pending',()=>{
  const partial={...result,skills:[{...result.skills[1],percentage:100}]}
  render(<ExamSimulation lang="de" initial={{...empty,active:{...session,status:'completed',result:partial}}} catalog={readyCatalog}/>)
  expect(screen.getByRole('img',{name:'Schreiben: Bewertung offen'})).toBeInTheDocument()
  expect(screen.queryByRole('img',{name:'Schreiben: 100 Prozent'})).not.toBeInTheDocument()
  expect(screen.getByText('Bewertung offen')).toBeInTheDocument()
})
