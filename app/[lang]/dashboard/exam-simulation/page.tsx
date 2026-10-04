import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { requestSession } from '@/lib/request-session'
import { getSimulationState } from '@/app/actions/exam-simulation'
import { getSimulationActor, simulationCatalog } from '@/lib/exam-simulation/server'
import { SIMULATION_UNIVERSAL_PROFILES } from '@/lib/exam-simulation/catalogue'
import ExamSimulation from '@/components/exam-simulation/ExamSimulation'

export const metadata:Metadata={title:'Simulierte Prüfung | Sitov Academy',robots:{index:false,follow:false}}
export const dynamic='force-dynamic'
export default async function SimulationPage({params,searchParams}:{params:Promise<{lang:string}>;searchParams:Promise<{level?:string}>}){
 const {lang}=await params,query=await searchParams,{user}=await requestSession()
 if(!user)redirect(`/${lang}/login`)
 const initial=await getSimulationState()
 const catalog=initial.available?await simulationCatalog(await getSimulationActor()):SIMULATION_UNIVERSAL_PROFILES.map(profile=>({...profile,practiceAvailable:false}))
 return <ExamSimulation initial={initial} catalog={catalog} lang={lang} initialLevel={query.level}/>
}
