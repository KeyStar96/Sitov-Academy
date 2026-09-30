import { getRegistrationOverview } from '@/app/actions/admin-registrations'
import RegistrationDesk from './RegistrationDesk'
import { registrationLabels } from '@/lib/admin-registration-i18n'
import { getRegistrationIdentityConflicts } from '@/app/actions/registration-identity'
import RegistrationIdentityConflicts from './RegistrationIdentityConflicts'
import { Notice, PageHeader, adminButton } from './ui'

export default async function RegistrationPageContent({lang,month,mode}:{lang:string;month?:string;mode:'registrations'|'invoices'}) {
  const [result,identities]=await Promise.all([
    getRegistrationOverview(month&&/^\d{4}-\d{2}$/.test(month)?`${month}-01`:undefined),
    mode==='registrations'?getRegistrationIdentityConflicts():Promise.resolve(null),
  ])
  const t=registrationLabels(lang)
  if(!result.success)return <div className="min-w-0 space-y-5"><PageHeader title={mode==='registrations'?t.registrations_title:t.invoices_title}/><Notice tone="warning" role="alert" action={<a href={`/${lang}/admin/${mode}`} className={adminButton('secondary','sm')}>{t.reload}</a>}>{t.failed}</Notice></div>
  // Identitätskonflikte nur zeigen, wenn wirklich etwas zu klären ist.
  const conflicts=identities&&(!identities.success||identities.data.length>0)?<RegistrationIdentityConflicts conflicts={identities.success?identities.data:[]} failed={!identities.success} lang={lang}/>:null
  return <RegistrationDesk key={`${mode}:${result.data.targetMonth}`} initial={result.data} lang={lang} mode={mode} notice={conflicts}/>
}
