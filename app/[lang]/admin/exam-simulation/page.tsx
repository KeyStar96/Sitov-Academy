import { redirect } from 'next/navigation'
import { getSimulationTeacherState } from '@/app/actions/exam-simulation'
import { createClient } from '@/utils/supabase/server'
import ExamSimulationTeacher from '@/components/exam-simulation/ExamSimulationTeacher'

export const metadata={title:'Simulierte Prüfung · Lehrkraft · Sitov Academy'}
export const dynamic='force-dynamic'
export default async function SimulationTeacherPage({params}:{params:Promise<{lang:string}>}){
 const {lang}=await params,client=await createClient(),{data:{user}}=await client.auth.getUser()
 if(!user)redirect(`/${lang}/login`)
 const {data:profile}=await client.from('profiles').select('role').eq('id',user.id).single()
 if(!['admin','teacher'].includes(profile?.role??''))redirect(`/${lang}/dashboard`)
 return <ExamSimulationTeacher initial={await getSimulationTeacherState()} lang={lang}/>
}
