import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import ExamSimulation, { FeedbackCard } from '@/components/exam-simulation/ExamSimulation'
import { SIMULATION_UNIVERSAL_PROFILES } from '@/lib/exam-simulation/catalogue'
import { SITOV_SIMULATION_UI_LANGUAGES, sitovSimulationCopy, sitovSimulationDescription, sitovSimulationHeadline } from '@/lib/exam-simulation/ui-copy'
import { sitovSimulationCriterion } from '@/lib/exam-simulation/criterion-copy'
import type { SimulationSession, SimulationTask, SimulationResult } from '@/lib/exam-simulation/types'
import * as actions from '@/app/actions/exam-simulation'

jest.unmock('lucide-react')
jest.mock('@/components/motion/PressableCard',()=>({__esModule:true,default:({children,href,...props}:{children:ReactNode;href?:string}&ComponentProps<'button'>)=>href?<a href={href}>{children}</a>:<button {...props}>{children}</button>}))
jest.mock('@/components/motion/SitovMotionStage',()=>({__esModule:true,default:({children,...props}:ComponentProps<'div'>)=><div {...props}>{children}</div>}))
jest.mock('@/components/exam-simulation/SimulationRecording',()=>({__esModule:true,default:()=>null}))
jest.mock('@/app/actions/exam-simulation',()=>({startExamSimulation:jest.fn(),saveSimulationAnswer:jest.fn(),finishExamSimulation:jest.fn(),startPreviewExamSimulation:jest.fn(),savePreviewSimulationAnswer:jest.fn(),finishPreviewExamSimulation:jest.fn(),getSimulationState:jest.fn()}))

const criterion='Alle Inhaltspunkte verständlich und zusammenhängend behandeln'
const task:SimulationTask={id:'sitov-localization-task',version:1,level:'B1',skill:'reading',family:'reading-detail',type:'choice',title:'Den Termin verstehen',instruction:'Wählen Sie den richtigen Termin.',text:'Der Kurs beginnt am Dienstag.',options:[{id:'a',text:'Am Dienstag'},{id:'b',text:'Am Montag'}],criteria:[criterion],maxPoints:1,minutes:1}
const second:SimulationTask={...task,id:'sitov-localization-second'}
const session:SimulationSession={id:'00000000-0000-4000-8000-000000000050',version:1,profileId:'sitov_b1',level:'B1',provider:'sitov',mode:'exam',title:'Simulierte Prüfung · B1',startedAt:'2026-10-04T12:00:00Z',expiresAt:'2099-10-04T12:00:00Z',status:'active',tasks:[task,second],answers:{},coverage:{included:[task.family],missing:[],fullExam:true,note:'Deutscher Prüfungsbericht'}}
const result:SimulationResult={status:'passed',headline:'Die Sitov-Prüfung bestanden',description:sitovSimulationCopy('de').t('fullRubric'),examPass:true,percentage:100,reviewedPoints:1,reviewedMaxPoints:1,totalMaxPoints:1,pendingTeacherTasks:0,missingSkills:[],skills:[{skill:'reading',title:'Lesen',points:1,maxPoints:1,percentage:100,pendingTeacherTasks:0,correctTasks:1,wrongTasks:0}],feedback:[{taskId:task.id,title:task.title,skill:'reading',family:task.family,answer:'a',correct:true,points:1,maxPoints:1,expectedAnswer:'a',explanation:'Die passende Aussage ist: Am Dienstag',evidence:task.text,criteria:[criterion]}],nextSteps:['Besprechen Sie die Einschätzung mit Ihrer Lehrkraft. Die Regeln Ihrer realen Prüfung können abweichen.']}
const initial={available:true,active:null,history:[]}
const catalog=SIMULATION_UNIVERSAL_PROFILES.map(profile=>({...profile,fullExamReleased:true,blockers:[]}))
beforeEach(()=>{jest.clearAllMocks();window.scrollTo=jest.fn();Object.defineProperty(globalThis.crypto,'randomUUID',{configurable:true,value:()=> '00000000-0000-4000-8000-000000000060'})})

it.each(SITOV_SIMULATION_UI_LANGUAGES)('uses %s before the exam and announces the German exam language',lang=>{
 const copy=sitovSimulationCopy(lang)
 const {container}=render(<ExamSimulation lang={lang} initial={initial} initialLevel="B1" catalog={catalog}/>)
 expect(container.firstElementChild).toHaveAttribute('lang',lang)
 expect(container.firstElementChild).not.toHaveAttribute('translate','no')
 expect(screen.getByRole('heading',{name:copy.t('selectedExam',{level:'B1'})})).toBeInTheDocument()
 expect(screen.getByRole('button',{name:copy.t('startExam')})).toBeEnabled()
 if(lang!=='de') expect(copy.t('startExam')).not.toBe(sitovSimulationCopy('de').t('startExam'))
 expect(screen.getByText(copy.t('germanNotice'))).toBeInTheDocument()
 expect(screen.getByText(copy.t('germanNotice')).closest('[lang="de"][translate="no"]')).toBeNull()
})

it.each(SITOV_SIMULATION_UI_LANGUAGES)('keeps German task content and answer payload while using %s navigation',async lang=>{
 const copy=sitovSimulationCopy(lang)
 jest.mocked(actions.saveSimulationAnswer).mockResolvedValue({success:true,session:{...session,answers:{[task.id]:'a'}}})
 render(<ExamSimulation lang={lang} initial={{...initial,active:session}} catalog={catalog}/>)
 const heading=screen.getByRole('heading',{name:task.title})
 expect(heading.closest('[lang="de"][translate="no"]')).not.toBeNull()
 expect(screen.getByText(task.text!)).toHaveAttribute('lang','de')
 expect(screen.getByText('Am Dienstag')).toHaveAttribute('translate','no')
 expect(screen.getByText(criterion)).toHaveAttribute('lang','de')
 expect(screen.getByText(criterion)).toHaveAttribute('translate','no')
 expect(screen.getByRole('button',{name:copy.t('taskOverview')})).toBeInTheDocument()
 expect(screen.getByRole('progressbar',{name:copy.t('answeredTasks')})).toHaveAttribute('aria-valuenow','0')
 fireEvent.click(screen.getByRole('radio',{name:/Am Dienstag/}))
 fireEvent.click(screen.getByRole('button',{name:copy.t('saveNext')}))
 await waitFor(()=>expect(actions.saveSimulationAnswer).toHaveBeenCalledWith({runId:session.id,taskId:task.id,answer:'a',requestId:'00000000-0000-4000-8000-000000000060'}))
})

it.each(SITOV_SIMULATION_UI_LANGUAGES)('uses %s for results, feedback labels and guidance with German answer quotations',lang=>{
 const copy=sitovSimulationCopy(lang)
 const {container}=render(<ExamSimulation lang={lang} initial={{...initial,active:{...session,status:'completed',result}}} catalog={catalog}/>)
 expect(screen.getByRole('heading',{name:sitovSimulationHeadline(lang,result)})).toBeInTheDocument()
 if(lang!=='de') expect(sitovSimulationHeadline(lang,result)).not.toBe(result.headline)
 expect(screen.getByRole('heading',{name:copy.t('understandAnswers')})).toBeInTheDocument()
 expect(screen.getByRole('button',{name:copy.t('newAttempt')})).toBeInTheDocument()
 expect(screen.getByText(copy.t('correctFeedback'))).toBeInTheDocument()
 expect(screen.getByText(copy.t('solutionPhrase'))).toBeInTheDocument()
 expect(screen.getByText(sitovSimulationCriterion(lang,criterion))).not.toHaveAttribute('translate','no')
 expect(screen.getAllByText('Am Dienstag').every(node=>node.getAttribute('lang')==='de'&&node.getAttribute('translate')==='no')).toBe(true)
 expect(container.firstElementChild).toHaveAttribute('lang',lang)
 if(lang!=='de'){
  expect(screen.queryByText(result.description)).not.toBeInTheDocument()
  expect(screen.queryByText(result.nextSteps[0])).not.toBeInTheDocument()
  expect(screen.getByText(copy.t('fullRubric'))).toBeInTheDocument()
  expect(screen.getByText(copy.t('nextDiscuss'))).toBeInTheDocument()
 }
})

it.each(SITOV_SIMULATION_UI_LANGUAGES)('translates missing performances and preserves human comments in %s without assuming their language',lang=>{
 const copy=sitovSimulationCopy(lang)
 const comment='Please revise your argument.'
 const productive={...task,type:'speaking' as const,skill:'speaking' as const}
 const {rerender}=render(<FeedbackCard lang={lang} task={productive} feedback={{...result.feedback[0],expectedAnswer:undefined,explanation:'Keine mündliche Aufnahme eingereicht. Ein Vorbereitungstext ersetzt diese Leistung nicht.',teacherReview:{teacherId:'teacher',score:10,maxPoints:20,comment,reviewedAt:'2026-10-04T12:30:00Z'}}}/>)
 expect(screen.getByText(copy.t('missingSpeaking'))).toBeInTheDocument()
 expect(screen.getByText(comment)).toHaveAttribute('lang','')
 expect(screen.getByText(comment)).toHaveAttribute('translate','no')
 for(const [source,key] of [['Kein Text eingereicht. Diese Leistung wurde mit null Punkten erfasst.','missingWriting'],['Für diese Gesprächsaufgabe fehlt die Bestätigung einer echten Interaktion. Positive Punkte allein belegen keine ausreichende Gesprächsleistung.','missingInteraction']] as const){
  rerender(<FeedbackCard lang={lang} task={productive} feedback={{...result.feedback[0],expectedAnswer:undefined,explanation:source}}/>)
  expect(screen.getByText(copy.t(key))).toBeInTheDocument()
 }
})

it.each(SITOV_SIMULATION_UI_LANGUAGES)('shows the gate and backend permission error in %s',async lang=>{
 const copy=sitovSimulationCopy(lang)
 const gated=render(<ExamSimulation lang={lang} initial={{...initial,available:false,accessLocked:true}} catalog={catalog}/>)
 expect(screen.getByRole('heading',{name:copy.t('gateTitle')})).toBeInTheDocument()
 expect(screen.getByRole('link',{name:copy.t('preparation')})).toHaveAttribute('href',`/${lang}/dashboard/exam-preparation`)
 gated.unmount()
 jest.mocked(actions.startExamSimulation).mockResolvedValue({success:false,error:'Für B1 fehlt die Niveau-Freigabe. Bitte wende dich an deine Lehrkraft.'})
 render(<ExamSimulation lang={lang} initial={initial} initialLevel="B1" catalog={catalog}/>)
 fireEvent.click(screen.getByRole('button',{name:copy.t('startExam')}))
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent(lang==='de'?'Für B1 fehlt die Niveau-Freigabe':copy.t('levelLocked')))
})

it('keeps the original true/false answer and solution in German inside translated comparison labels',()=>{
 const decision={...task,type:'true-false' as const,options:undefined}
 render(<FeedbackCard lang="en" task={decision} feedback={{...result.feedback[0],answer:'true',expectedAnswer:'Richtig'}}/>)
 expect(screen.getByText('Your answer')).toBeInTheDocument()
 expect(screen.getByText('Correct solution')).toBeInTheDocument()
 expect(screen.getAllByText('Richtig').every(node=>node.getAttribute('lang')==='de')).toBe(true)
 expect(screen.queryByText('true')).not.toBeInTheDocument()
})


it.each(SITOV_SIMULATION_UI_LANGUAGES)('keeps the practice-only assessment meaning in %s for a historical attempt',lang=>{
 const copy=sitovSimulationCopy(lang)
 const practice={...result,examPass:null,status:'practice-strong' as const,description:sitovSimulationCopy('de').t('resultDisclaimer')}
 expect(sitovSimulationDescription(lang,practice)).toBe(copy.t('resultDisclaimer'))
})
