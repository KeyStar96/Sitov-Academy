import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import pilotModule from '@/content/exam-preparation/sitov-b1-pilot.json'
import type { ComponentProps, ReactNode } from 'react'
jest.mock('lucide-react',()=>jest.requireActual('lucide-react'))
jest.mock('@/components/motion/PressableCard',()=>({__esModule:true,default:({children,href,...props}:{children:ReactNode;href?:string}&ComponentProps<'button'>)=>href?<a href={href}>{children}</a>:<button {...props}>{children}</button>}))
jest.mock('@/components/motion/SitovMotionStage',()=>({__esModule:true,default:({children,...props}:ComponentProps<'div'>)=><div {...props}>{children}</div>}))
jest.mock('@/components/exam-preparation/ExamSubmissionEditor',()=>({__esModule:true,default:()=> <p>Eigener Beitrag</p>}))
jest.mock('@/app/actions/exam-preparation',()=>({getExamHint:jest.fn(),getExamState:jest.fn(),getExamCheckpointFeedback:jest.fn(),saveExamProfile:jest.fn(),submitExamAnswer:jest.fn(),markExamFeedbackViewed:jest.fn(),deleteExamSubmission:jest.fn(),activateExamFallback:jest.fn()}))
import { getExamHint, getExamCheckpointFeedback, submitExamAnswer, markExamFeedbackViewed, saveExamProfile } from '@/app/actions/exam-preparation'
import { localizeExamPrepExplanation } from '@/lib/exam-preparation/feedback-copy'
import ExamTrainer from '@/components/exam-preparation/ExamTrainer'
import type { ExamAttempt, ExamModule, ExamState, ExamTask, ExamUnit } from '@/lib/exam-preparation/types'

const empty:ExamState={available:true,profileId:'general_b1',attempts:[],submissions:[],overrides:[],fallbackModules:[],teacher:null}
const task=(i:number):ExamTask=>({id:`sitov-ui-${i}`,version:1,type:'choice',skill:i<5?'listening':'reading',title:`Frage ${i+1}`,instruction:'Wähle eine Antwort.',text:'Ein eigener Text.',options:[{id:'a',text:'Erste Antwort'},{id:'b',text:'Zweite Antwort'}],hints:[],profiles:['general_b1'],competency:'Information',formatFamily:'detailverstehen',estimatedMinutes:1,releaseStatus:'published',provenance:'Sitov Academy'})
const receipt=(t:ExamTask,i=0):ExamAttempt=>({id:`attempt-${t.id}`,taskId:t.id,taskVersion:1,unitId:'sitov-ui-unit',answer:'a',correct:null,helped:false,feedbackViewed:false,createdAt:`2026-10-03T12:00:${String(i).padStart(2,'0')}Z`,seconds:4,mode:'checkpoint',variant:0})
function fixture(checkpoint=false){
 const unit:ExamUnit={id:'sitov-ui-unit',moduleId:'sitov-ui-module',order:1,title:checkpoint?'Neuer Lerncheck':'Informationen lesen',description:'Ein eigener Lernschritt.',kind:checkpoint?'checkpoint':'reading',required:true,estimatedMinutes:10,releaseStatus:'published',tasks:checkpoint?Array.from({length:10},(_,i)=>task(i)):[task(5)]}
 const courseModule:ExamModule={id:unit.moduleId,order:1,title:'Kontakt',description:'Gemeinsam üben.',units:[unit],releaseStatus:'published'}
 return {unit,module:courseModule}
}
beforeEach(()=>{jest.clearAllMocks();window.scrollTo=jest.fn();Object.defineProperty(globalThis.crypto,'randomUUID',{configurable:true,value:()=> '00000000-0000-4000-8000-000000000001'})})
it('opens preparation in Russian with three clear areas and retains localized links',()=>{
 const {module}=fixture();const view=render(<ExamTrainer lang="ru" initial={empty} modules={[module]} workshops={[]} boxLevel="B1.1" />)
 expect(screen.getByRole('heading',{name:'Подготовка к экзамену'})).toBeInTheDocument()
 expect(screen.queryByLabelText('Meine Zielprüfung')).not.toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Учиться'})).toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Мои работы'})).toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Прогресс'})).toBeInTheDocument()
 expect(screen.queryByRole('button',{name:'Prüfung üben'})).not.toBeInTheDocument()
 expect(screen.getByRole('link',{name:'К пробному экзамену'})).toHaveAttribute('href','/ru/dashboard/exam-simulation?level=B1')
 fireEvent.click(screen.getByRole('button',{name:'Тренировать навык'}))
 expect(screen.getByRole('heading',{name:'Что вы хотите потренировать?'})).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Вернуться к обучению'}))
 expect(screen.getByRole('heading',{name:'Ваш следующий шаг'})).toBeInTheDocument()
 expect(screen.queryByRole('button',{name:/übersetzen|translate/i})).not.toBeInTheDocument()
 view.rerender(<ExamTrainer preview lang="ru" initial={empty} modules={[module]} workshops={[]} boxLevel="B1.1" />)
 expect(screen.getByRole('link',{name:'К пробному экзамену'})).toHaveAttribute('href','/ru/sitov-preview/exam-simulation?level=B1')
 expect(screen.getByRole('status')).toHaveTextContent('Предпросмотр · Введённые данные не сохраняются.')
})
it('stores an answer before completion and counts feedback only after the explicit read action',async()=>{
 const {module,unit}=fixture(),t=unit.tasks[0],attempt={...receipt(t),mode:'practice' as const,correct:true}
 jest.mocked(submitExamAnswer).mockResolvedValue({success:true,attempt,feedback:{explanation:'Eine neue Information.',evidence:'Eine belegte Stelle.'},state:{...empty,attempts:[attempt]}})
 jest.mocked(markExamFeedbackViewed).mockResolvedValue({success:true,state:{...empty,attempts:[{...attempt,feedbackViewed:true}]}})
 render(<ExamTrainer lang="de" initial={empty} modules={[module]} workshops={[]} boxLevel="B1.1" initialLevel="B1"/>)
 fireEvent.click(screen.getByRole('button',{name:/Weiterlernen:/}));fireEvent.click(screen.getByRole('button',{name:'A Erste Antwort'}));fireEvent.click(screen.getByRole('button',{name:/Antwort prüfen/}))
 await screen.findByText('Eine belegte Stelle.')
 expect(markExamFeedbackViewed).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button',{name:/Rückmeldung gelesen/}))
 await waitFor(()=>expect(markExamFeedbackViewed).toHaveBeenCalledWith({attemptId:attempt.id}))
})
it('records a requested hint and passes that help evidence to server grading',async()=>{
 const {module}=fixture();jest.mocked(getExamHint).mockResolvedValue({success:true,hints:['Achte auf die Änderung.']})
 jest.mocked(submitExamAnswer).mockResolvedValue({success:false,error:'Bitte erneut versuchen.'})
 render(<ExamTrainer lang="de" initial={empty} modules={[module]} workshops={[]} boxLevel="B1.1" initialLevel="B1"/>)
 fireEvent.click(screen.getByRole('button',{name:/Weiterlernen:/}));fireEvent.click(screen.getByRole('button',{name:/Hilfe ansehen/}))
 await screen.findByText('Achte auf die Änderung.');fireEvent.click(screen.getByRole('button',{name:'A Erste Antwort'}));fireEvent.click(screen.getByRole('button',{name:/Antwort prüfen/}))
 await waitFor(()=>expect(submitExamAnswer).toHaveBeenCalledWith(expect.objectContaining({helped:true,answer:'a'})))
 expect(await screen.findByRole('alert')).toHaveTextContent('Bitte erneut versuchen.')
 expect(screen.getByRole('button',{name:'A Erste Antwort'})).toHaveAttribute('aria-pressed','true')
})
it('resumes the same incomplete checkpoint variant, hides help and feedback, and opens feedback after all ten',async()=>{
 const {module,unit}=fixture(true),prior=unit.tasks.slice(0,9).map(receipt)
 const last=receipt(unit.tasks[9],9)
 jest.mocked(submitExamAnswer).mockResolvedValue({success:true,attempt:last,state:{...empty,attempts:[...prior,last]}})
 jest.mocked(getExamCheckpointFeedback).mockResolvedValue({success:true,results:unit.tasks.map(t=>({success:true,attempt:{...receipt(t),correct:true},feedback:{explanation:'Serverseitige Schlussrückmeldung.',evidence:'Der Beleg.'}}))})
 render(<ExamTrainer lang="de" initial={{...empty,attempts:prior}} modules={[module]} workshops={[]} boxLevel="B1.1" initialLevel="B1"/>)
 fireEvent.click(screen.getByRole('button',{name:/Weiterlernen:/}))
 expect(screen.getByRole('heading',{name:'Frage 10'})).toBeInTheDocument();expect(screen.queryByRole('button',{name:/Hilfe ansehen/})).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'A Erste Antwort'}));fireEvent.click(screen.getByRole('button',{name:'Antwort speichern'}))
 await screen.findByText('Antwort gespeichert');expect(screen.queryByText('Serverseitige Schlussrückmeldung.')).not.toBeInTheDocument()
 expect(submitExamAnswer).toHaveBeenCalledWith(expect.objectContaining({variant:0,mode:'checkpoint',taskId:unit.tasks[9].id}))
 fireEvent.click(screen.getByRole('button',{name:'Weiter'}));fireEvent.click(await screen.findByRole('button',{name:/Lerncheck abgeschlossen/}))
 await waitFor(()=>expect(getExamCheckpointFeedback).toHaveBeenCalledWith({unitId:unit.id,variant:0}))
 expect(await screen.findByText('10/10 geschlossene Antworten richtig')).toBeInTheDocument()
 expect(markExamFeedbackViewed).not.toHaveBeenCalled()
})
it('retains common attempts and an existing preference without offering a provider picker',()=>{
 const {module}=fixture(),old={...receipt(module.units[0].tasks[0]),mode:'practice' as const,correct:true,feedbackViewed:true}
 render(<ExamTrainer lang="de" initial={{...empty,profileId:'goethe_b1',attempts:[old]}} modules={[module]} workshops={[]} boxLevel="B1.1" initialLevel="B1"/>)
 expect(screen.queryByLabelText('Meine Zielprüfung')).not.toBeInTheDocument()
 expect(saveExamProfile).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button',{name:'Fortschritt'}))
 expect(screen.getByText('Aufgaben mit Rückmeldung').previousElementSibling).toHaveTextContent('1')
 expect(screen.queryByText(/Goethe-Zertifikat/)).not.toBeInTheDocument()
})
it('blocks grading after an audio failure and preserves the selected answer for recovery',()=>{
 const {module}=fixture();module.units[0].tasks[0].audio={id:'sitov-audio-test',script:'',status:'prepared',route:'qwen',roles:['Männlicher Sprecher'],notes:'',src:'/prepared.mp3'}
 render(<ExamTrainer lang="de" initial={empty} modules={[module]} workshops={[]} boxLevel="B1.1" initialLevel="B1"/>)
 fireEvent.click(screen.getByRole('button',{name:/Weiterlernen:/}));fireEvent.click(screen.getByRole('button',{name:'A Erste Antwort'}))
 fireEvent.error(screen.getByLabelText('Hörtext abspielen'))
 expect(screen.getByRole('button',{name:/Antwort prüfen/})).toBeDisabled();expect(submitExamAnswer).not.toHaveBeenCalled()
 expect(screen.getByRole('button',{name:'Hörtext erneut laden'})).toBeInTheDocument()
 fireEvent.canPlay(screen.getByLabelText('Hörtext abspielen'))
 expect(screen.getByRole('button',{name:/Antwort prüfen/})).toBeEnabled();expect(screen.getByRole('button',{name:'A Erste Antwort'})).toHaveAttribute('aria-pressed','true')
})
it('offers the listening transcript only after the learner has submitted an answer',async()=>{
 const {module,unit}=fixture(),t=unit.tasks[0];t.audio={id:'sitov-audio-test',script:'',status:'prepared',route:'qwen',roles:['Männlicher Sprecher'],notes:'',src:'/prepared.mp3'}
 const attempt={...receipt(t),mode:'practice' as const,correct:true}
 jest.mocked(submitExamAnswer).mockResolvedValue({success:true,attempt,feedback:{explanation:'Rückmeldung nach der Antwort.',evidence:'Der Beleg.'},state:{...empty,attempts:[attempt]}})
 jest.mocked(getExamHint).mockResolvedValue({success:true,transcript:'Jetzt darfst du den Hörtext mitlesen.'})
 render(<ExamTrainer lang="de" initial={empty} modules={[module]} workshops={[]} boxLevel="B1.1" initialLevel="B1"/>)
 fireEvent.click(screen.getByRole('button',{name:/Weiterlernen:/}));expect(screen.queryByRole('button',{name:/Hilfe ansehen|Hörtext nach deiner Antwort/})).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'A Erste Antwort'}));fireEvent.click(screen.getByRole('button',{name:/Antwort prüfen/}))
 fireEvent.click(await screen.findByRole('button',{name:'Hörtext nach deiner Antwort mitlesen'}));expect(await screen.findByText('Jetzt darfst du den Hörtext mitlesen.')).toBeInTheDocument()
 expect(getExamHint).toHaveBeenCalledWith({taskId:t.id,unitId:unit.id})
})

const sitovPrepLocales = [
 {lang:'de',heading:'Prüfungsvorbereitung',start:'Weiterlernen:',overview:'Zur Übersicht',check:'Antwort prüfen',positive:'Das passt.'},
 {lang:'en',heading:'Exam preparation',start:'Continue learning:',overview:'Overview',check:'Check answer',positive:'That’s right.'},
 {lang:'ru',heading:'Подготовка к экзамену',start:'Продолжить обучение:',overview:'К обзору',check:'Проверить ответ',positive:'Верно.'},
 {lang:'uk',heading:'Підготовка до іспиту',start:'Продовжити навчання:',overview:'До огляду',check:'Перевірити відповідь',positive:'Правильно.'},
 {lang:'tr',heading:'Sınava hazırlık',start:'Öğrenmeye devam et:',overview:'Genel bakış',check:'Yanıtı kontrol et',positive:'Doğru.'},
] as const

it.each(sitovPrepLocales)('uses $lang UI before and after the unchanged German preparation task',async locale=>{
 const pilot = pilotModule as unknown as ExamModule
 const originalTask=pilot.units[0].tasks[0]
 const unit={...pilot.units[0],tasks:[originalTask]}
 const courseModule={...pilot,units:[unit]}
 const attempt={...receipt(originalTask),unitId:unit.id,mode:'practice' as const,correct:true}
 jest.mocked(submitExamAnswer).mockResolvedValue({success:true,attempt,feedback:{explanation:originalTask.explanation??'',evidence:originalTask.evidence??''},state:{...empty,attempts:[attempt]}})
 const {container}=render(<ExamTrainer lang={locale.lang} initial={empty} modules={[courseModule]} workshops={[]} boxLevel="B1.1" />)
 expect(screen.getByRole('heading',{name:locale.heading})).toBeInTheDocument()
 expect(container.firstElementChild).toHaveAttribute('lang',locale.lang)
 fireEvent.click(screen.getByRole('button',{name:new RegExp(locale.start)}))
 expect(screen.getByRole('button',{name:locale.overview})).toBeInTheDocument()
 const heading=screen.getByRole('heading',{name:originalTask.title})
 expect(heading).toHaveAttribute('lang','de')
 expect(heading).toHaveAttribute('translate','no')
 expect(screen.getByText(originalTask.instruction)).toHaveAttribute('lang','de')
 const answer=screen.getByText(originalTask.options![0].text)
 expect(answer).toHaveAttribute('lang','de')
 fireEvent.click(answer.closest('button')!)
 fireEvent.click(screen.getByRole('button',{name:locale.check}))
 expect(await screen.findByText(locale.positive)).toBeInTheDocument()
 expect(screen.getByText(localizeExamPrepExplanation(locale.lang,originalTask.explanation??''))).toBeInTheDocument()
 expect(screen.getByText(originalTask.evidence!)).toHaveAttribute('lang','de')
 expect(screen.getByText(originalTask.evidence!)).toHaveAttribute('translate','no')
 expect(submitExamAnswer).toHaveBeenCalledWith(expect.objectContaining({taskId:originalTask.id,answer:originalTask.options![0].id}))
})

it('translates explanatory audio hints after answering while retaining the German transcript',async()=>{
 const {module,unit}=fixture(),t=unit.tasks[0]
 t.audio={id:'sitov-audio-test',script:'',status:'prepared',route:'qwen',roles:['Männlicher Sprecher'],notes:'',src:'/prepared.mp3'}
 const attempt={...receipt(t),mode:'practice' as const,correct:true}
 jest.mocked(submitExamAnswer).mockResolvedValue({success:true,attempt,state:{...empty,attempts:[attempt]}})
 jest.mocked(getExamHint).mockResolvedValue({success:true,hints:['Halb elf bedeutet 10:30 Uhr.'],transcript:'Wir treffen uns morgen um halb elf.'})
 render(<ExamTrainer lang="en" initial={empty} modules={[module]} workshops={[]} boxLevel="B1.1" />)
 fireEvent.click(screen.getByRole('button',{name:/Continue learning:/}))
 fireEvent.click(screen.getByRole('button',{name:'A Erste Antwort'}))
 fireEvent.click(screen.getByRole('button',{name:'Check answer'}))
 fireEvent.click(await screen.findByRole('button',{name:'Read the transcript after answering'}))
 const hint=await screen.findByText('“Halb elf” means 10:30.')
 expect(hint).toHaveAttribute('lang','en')
 expect(hint).not.toHaveAttribute('translate','no')
 const transcript=screen.getByText('Wir treffen uns morgen um halb elf.')
 expect(transcript).toHaveAttribute('lang','de')
 expect(transcript).toHaveAttribute('translate','no')
})

it('localizes authored explanatory evidence without translating German source quotes',async()=>{
 const {module,unit}=fixture(),task=unit.tasks[0],attempt={...receipt(task),mode:'practice' as const,correct:true}
 jest.mocked(submitExamAnswer).mockResolvedValue({success:true,attempt,feedback:{explanation:'',evidence:'Wörter und Erklärungen gehören jeweils zusammen.'},state:{...empty,attempts:[attempt]}})
 render(<ExamTrainer lang="en" initial={empty} modules={[module]} workshops={[]} boxLevel="B1.1" />)
 fireEvent.click(screen.getByRole('button',{name:/Continue learning:/}))
 fireEvent.click(screen.getByRole('button',{name:'A Erste Antwort'}))
 fireEvent.click(screen.getByRole('button',{name:'Check answer'}))
 const evidence=await screen.findByText('Each word matches its explanation.')
 expect(evidence).toHaveAttribute('lang','en')
 expect(evidence).not.toHaveAttribute('translate','no')
})
