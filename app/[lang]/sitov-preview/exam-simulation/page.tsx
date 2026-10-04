import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ExamSimulation from '@/components/exam-simulation/ExamSimulation'
import ExamPreviewShell from '@/components/exam-preparation/ExamPreviewShell'
import { simulationCatalog } from '@/lib/exam-simulation/server'
import { getSitovExamEntryCopy } from '@/lib/exam-entry-i18n'
import '@/components/dashboard/student.css'

export async function generateMetadata({params}:{params:Promise<{lang:string}>}):Promise<Metadata>{
 const {lang}=await params
 return {title:`${getSitovExamEntryCopy(lang).simulation} | Sitov Academy`,robots:{index:false,follow:false}}
}

export default async function SimulationPreview({params,searchParams}:{params:Promise<{lang:string}>;searchParams:Promise<{level?:string;view?:string}>}){
 if(process.env.NODE_ENV!=='development')notFound()
 const {lang}=await params,query=await searchParams
 const locked=query.view==='locked'
 return <ExamPreviewShell lang={lang} area="exam-simulation"><ExamSimulation preview={!locked} lang={lang} initialLevel={query.level} catalog={locked?[]:await simulationCatalog()} initial={{available:!locked,accessLocked:locked,active:null,history:[]}}/></ExamPreviewShell>
}
