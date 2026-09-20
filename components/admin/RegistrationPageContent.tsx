import { getRegistrationOverview } from '@/app/actions/admin-registrations'
import RegistrationDesk from './RegistrationDesk'
import { registrationLabels } from '@/lib/admin-registration-i18n'
import { getRegistrationIdentityConflicts } from '@/app/actions/registration-identity'
import RegistrationIdentityConflicts from './RegistrationIdentityConflicts'
export default async function RegistrationPageContent({lang,month,mode}:{lang:string;month?:string;mode:'registrations'|'invoices'}) {
  const [result,identities]=await Promise.all([
    getRegistrationOverview(month&&/^\d{4}-\d{2}$/.test(month)?`${month}-01`:undefined),
    mode==='registrations'?getRegistrationIdentityConflicts():Promise.resolve(null),
  ])
  const t=registrationLabels(lang)
  if(!result.success)return <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8"><h1 className="text-3xl font-bold">{mode==='registrations'?t.registrations_title:t.invoices_title}</h1><p role="alert" className="mt-5 text-[var(--muted)]">{t.failed}</p><a href={`/${lang}/admin/${mode}`} className="mt-5 inline-flex min-h-12 items-center rounded-xl border border-[var(--border)] px-5">{t.reload}</a></div>
  return <>{identities&&<RegistrationIdentityConflicts conflicts={identities.success?identities.data:[]} failed={!identities.success} lang={lang}/>}<RegistrationDesk key={`${mode}:${result.data.targetMonth}`} initial={result.data} lang={lang} mode={mode}/></>
}
