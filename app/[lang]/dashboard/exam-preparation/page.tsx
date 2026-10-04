import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { requestSession } from '@/lib/request-session'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { hasLevelAccess } from '@/lib/access/levels'
import { getExamState } from '@/app/actions/exam-preparation'
import { getPublicExamCatalog } from '@/lib/exam-preparation/server'
import ExamTrainer from '@/components/exam-preparation/ExamTrainer'
import { getSitovExamEntryCopy } from '@/lib/exam-entry-i18n'

export async function generateMetadata({params}:{params:Promise<{lang:string}>}):Promise<Metadata>{
  const {lang}=await params
  return {title:`${getSitovExamEntryCopy(lang).preparation} | Sitov Academy`,robots:{index:false,follow:false}}
}
export default async function ExamPreparationPage({params,searchParams}: {
  params:Promise<{lang:string}>;searchParams:Promise<{level?:string;area?:string}>
}) {
  const {lang}=await params
  const {supabase,user}=await requestSession()
  if(!user)redirect(`/${lang}/login`)
  const access=await loadLevelAccessProfile(supabase,user.id)
  const allowed=hasLevelAccess(access,'B1.1')||hasLevelAccess(access,'B1.2')
  const query=await searchParams
  if(!allowed)return <ExamTrainer lang={lang} initial={{available:false,error:'Die B1-Prüfungsvorbereitung benötigt eine B1-Freigabe. Bitte wende dich an deine Lehrkraft.',profileId:'general_b1',attempts:[],submissions:[],overrides:[],fallbackModules:[],teacher:null}} modules={[]} workshops={[]} initialLevel={query.level} boxLevel={null}/>
  const [initial,catalog]=await Promise.all([getExamState(),getPublicExamCatalog()])
  return <ExamTrainer lang={lang} initial={initial} {...catalog} initialLevel={query.level}
    initialArea={query.area==='progress'?'progress':'path'} boxLevel={hasLevelAccess(access,'B1.1')?'B1.1':'B1.2'}/>
}
