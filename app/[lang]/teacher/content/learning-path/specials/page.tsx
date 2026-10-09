import {redirect,notFound} from 'next/navigation'
import {createClient} from '@/utils/supabase/server'
import {loadSitovSpecialStaffTargets} from '@/lib/learning/sitov-learning-specials-staff-server'
import {sitovSpecialStaffTargetsResultSchema} from '@/lib/learning/sitov-learning-specials-staff-contract'
import {sitovSpecialStaffTargetsCopy} from '@/lib/learning/sitov-learning-specials-staff-i18n'
import {LOCALES} from '@/lib/locale-routing'
import SitovLearningSpecialStaffTargets from '@/components/admin/SitovLearningSpecialStaffTargets'
export const dynamic='force-dynamic'
export async function generateMetadata({params}:{params:Promise<{lang:string}>}){
 const {lang}=await params
 return {title:sitovSpecialStaffTargetsCopy(lang).title,robots:{index:false,follow:false}}
}
export default async function SitovSpecialStaffPage({params}:{params:Promise<{lang:string}>}){
 const {lang}=await params
 if(!(LOCALES as readonly string[]).includes(lang))notFound()
 const client=await createClient(),auth=await client.auth.getUser()
 if(auth.error||!auth.data.user)redirect(`/${lang}/login`)
 const parsed=sitovSpecialStaffTargetsResultSchema.safeParse(await loadSitovSpecialStaffTargets({level:null}))
 const initial=parsed.success?parsed.data:{ok:false as const,error:'not_found' as const,retryable:false as const}
 if(initial.ok===false&&initial.error==='authentication_required')redirect(`/${lang}/login`)
 // Current database staff/MFA denial renders no target or private catalog.
 return <SitovLearningSpecialStaffTargets accountKey={auth.data.user.id} lang={lang} initial={initial}/>
}
