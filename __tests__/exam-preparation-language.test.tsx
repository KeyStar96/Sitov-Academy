import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { EXAM_MODULES, EXAM_WORKSHOPS, EXAM_PRACTICE_MODULES, EXAM_TASKS } from '@/lib/exam-preparation/content'
import { examPrepText, hasExamPrepUiTranslation, examPrepError } from '@/lib/exam-preparation/ui-copy'
import type { ExamState } from '@/lib/exam-preparation/types'
import ExamSubmissionEditor from '@/components/exam-preparation/ExamSubmissionEditor'
import ExamWordBox from '@/components/exam-preparation/ExamWordBox'
import ExamProgressCard from '@/components/exam-preparation/ExamProgressCard'
import ExamLoading from '@/app/[lang]/dashboard/exam-preparation/loading'
import ExamError from '@/app/[lang]/dashboard/exam-preparation/error'

jest.mock('lucide-react',()=>jest.requireActual('lucide-react'))
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/app/actions/exam-preparation', () => ({ createExamUpload: jest.fn(), saveExamSubmission: jest.fn() }))
jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/components/motion/PressableCard', () => ({ __esModule:true, default:({children,href,...props}:{children:ReactNode;href?:string}&ComponentProps<'button'>)=>href?<a href={href}>{children}</a>:<button {...props}>{children}</button> }))
jest.mock('@/lib/audio/useAudioRecorder', () => ({ useAudioRecorder:()=>({ status:'denied',levels:[],elapsedSeconds:0,audioUrl:null,audioBlob:null,isRecording:false,hasRecording:false,analyserRef:{current:null},start:jest.fn(),stop:jest.fn(),reset:jest.fn() }) }))
let sitovRouteLang = 'de'
jest.mock('next/navigation', () => ({ useParams:()=>({lang:sitovRouteLang}) }))

const empty:ExamState={available:true,profileId:'general_b1',attempts:[],submissions:[],overrides:[],fallbackModules:[],teacher:null}
const writing = EXAM_TASKS.find(task=>task.type==='writing'&&task.releaseStatus==='published')!
const speaking = EXAM_TASKS.find(task=>task.type==='speaking'&&task.releaseStatus==='published')!
const unit=EXAM_MODULES[0].units[0]
const locales = [
 {lang:'de',text:'Dein Text',save:'Als Entwurf speichern',words:'Meine Wörter und Wendungen',progress:'B1-Prüfungsvorbereitung',load:'Prüfungsvorbereitung wird geladen',reload:'Erneut laden'},
 {lang:'en',text:'Your text',save:'Save as draft',words:'My words and phrases',progress:'B1 exam preparation',load:'Loading exam preparation',reload:'Reload'},
 {lang:'ru',text:'Ваш текст',save:'Сохранить как черновик',words:'Мои слова и выражения',progress:'Подготовка к экзамену B1',load:'Загрузка подготовки к экзамену',reload:'Загрузить снова'},
 {lang:'uk',text:'Ваш текст',save:'Зберегти як чернетку',words:'Мої слова й вирази',progress:'Підготовка до іспиту B1',load:'Завантаження підготовки до іспиту',reload:'Завантажити знову'},
 {lang:'tr',text:'Metnin',save:'Taslak olarak kaydet',words:'Kelimelerim ve ifadelerim',progress:'B1 sınavına hazırlık',load:'Sınava hazırlık yükleniyor',reload:'Yeniden yükle'},
] as const

it.each(['en','ru','uk','tr'])('covers the whole preparation catalogue and authored assessment criteria in %s',lang=>{
 const modules=[...EXAM_MODULES,...EXAM_WORKSHOPS,...EXAM_PRACTICE_MODULES]
 const catalogue=modules.flatMap(module=>[module.title,module.description,...[...module.units,...(module.fallbackUnits??[])].flatMap(item=>[item.title,item.description])])
 const rubric=EXAM_TASKS.flatMap(task=>task.rubric??[])
 for(const source of new Set([...catalogue,...rubric])) {
   expect(hasExamPrepUiTranslation(source)).toBe(true)
   expect(examPrepText(lang,source)).not.toBe(source)
   expect(examPrepText(lang,source)).not.toBe('')
 }
})

it.each(locales)('localizes $lang recording/upload guidance, criteria, progress and word navigation',locale=>{
 const {rerender}=render(<ExamSubmissionEditor lang={locale.lang} task={writing} unit={unit} state={empty} onSaved={jest.fn()} />)
 expect(screen.getByLabelText(locale.text)).toHaveAttribute('lang','de')
 expect(screen.getByRole('button',{name:locale.save})).toBeDisabled()
 expect(screen.getByText(examPrepText(locale.lang,writing.rubric![0]))).toBeInTheDocument()
 rerender(<ExamSubmissionEditor lang={locale.lang} task={speaking} unit={unit} state={empty} onSaved={jest.fn()} />)
 expect(screen.getByRole('status')).toHaveTextContent(examPrepText(locale.lang,'Das Mikrofon ist gesperrt. Du kannst eine vorhandene Aufnahme hochladen.'))
 rerender(<ExamProgressCard lang={locale.lang} state={empty} modules={EXAM_MODULES} workshops={EXAM_WORKSHOPS} />)
 expect(screen.getByRole('heading',{name:locale.progress})).toBeInTheDocument()
 expect(screen.getByText(examPrepText(locale.lang,EXAM_MODULES[0].title))).toBeInTheDocument()
 rerender(<ExamWordBox lang={locale.lang} level="B1.1" words={[{word:'nachfragen',example:'Ich frage nach.'}]} />)
 expect(screen.getByText(locale.words)).toBeInTheDocument()
 expect(screen.getByText('nachfragen')).toHaveAttribute('lang','de')
 expect(screen.getByText('Ich frage nach.')).toHaveAttribute('translate','no')
 if(locale.lang!=='de')expect(screen.getByRole('link')).toHaveAttribute('href',`/${locale.lang}/dashboard/level/B1.1/vocabulary/lessons?sitovWord=nachfragen&sitovExample=Ich%20frage%20nach.`)
})

it.each(locales)('uses $lang for loading, errors and the documented retry action',locale=>{
 sitovRouteLang=locale.lang
 const retry=jest.fn()
 const {rerender}=render(<ExamLoading />)
 expect(screen.getByRole('status',{name:locale.load})).toHaveAttribute('lang',locale.lang)
 rerender(<ExamError retry={retry} />)
 fireEvent.click(screen.getByRole('button',{name:locale.reload}))
 expect(retry).toHaveBeenCalledTimes(1)
 if(locale.lang!=='de')expect(screen.queryByText('Bitte versuche es erneut. Deine gespeicherten Antworten bleiben erhalten.')).not.toBeInTheDocument()
})

it('keeps quoted German words while localizing generic unknown server-error guidance',()=>{
 expect(examPrepError('tr','Interner deutscher Serverfehler','Speichern fehlgeschlagen. Bitte versuche es erneut.')).toBe('Kaydetme başarısız oldu. Lütfen tekrar dene.')
 expect(examPrepText('en','{count} Einheiten bearbeitet',{count:3})).toBe('3 units completed')
})
