import { notFound } from 'next/navigation'
import ExamTrainer from '@/components/exam-preparation/ExamTrainer'
import ExamPreviewShell from '@/components/exam-preparation/ExamPreviewShell'
import { EXAM_MODULES, EXAM_WORKSHOPS } from '@/lib/exam-preparation/content'
import type { ExamModule, ExamTask } from '@/lib/exam-preparation/types'
import '@/components/dashboard/student.css'

export default async function ExamPreview({params,searchParams}:{params:Promise<{lang:string}>;searchParams:Promise<{level?:string}>}){
  if(process.env.NODE_ENV!=='development')notFound()
  const {lang}=await params,query=await searchParams
  const strip=(task:ExamTask):ExamTask=>{const publicTask={...task};delete publicTask.correctAnswer;delete publicTask.explanation;delete publicTask.evidence;return {...publicTask,hints:[],...(task.audio?{audio:{...task.audio,script:'',notes:'',src:undefined}}:{})}}
  const safe=(m:ExamModule):ExamModule=>({...m,units:m.units.map(u=>({...u,tasks:u.tasks.map(strip),variants:u.variants?.map(v=>v.map(strip))})),fallbackUnits:m.fallbackUnits?.map(u=>({...u,tasks:u.tasks.map(strip)}))})
  return <ExamPreviewShell lang={lang} area="exam-preparation"><ExamTrainer preview lang={lang} boxLevel="B1.1" modules={EXAM_MODULES.map(safe)} workshops={EXAM_WORKSHOPS.map(safe)} initialLevel={query.level}
    initial={{available:true,profileId:'general_b1',attempts:[],submissions:[],overrides:[],fallbackModules:[],teacher:null}}/></ExamPreviewShell>
}
