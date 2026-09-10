import { BookOpen, ShieldCheck } from 'lucide-react'
import { registrationLabels } from '@/lib/admin-registration-i18n'
import type { VerifiedCourseHistory } from '@/lib/types/admin-registrations'
import { getDictionary } from '@/lib/dictionary'
export default async function ProfileCourseHistory({history,lang}:{history:VerifiedCourseHistory|null;lang:string}) {
  const t=registrationLabels(lang)
  const dict=await getDictionary(lang)
  const courses:Record<string,{title?:string}>=dict.CourseData
  return <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7"><div className="flex items-start gap-3"><span className="rounded-2xl bg-[var(--violet)]/10 p-3 text-[var(--violet)]"><BookOpen size={23} aria-hidden="true"/></span><div><h2 className="text-xl font-bold text-[var(--foreground)]">{t.history_title}</h2><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{t.history_intro}</p></div></div>
    {!history?<p role="status" className="mt-5 text-[var(--muted)]">{t.history_failed}</p>:<>
      {history.unresolved&&<p className="mt-5 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-amber-950 dark:bg-amber-950 dark:text-amber-200"><ShieldCheck className="shrink-0" size={22} aria-hidden="true"/>{t.identity_unresolved}</p>}
      {history.registrations.length===0?<p className="mt-6 rounded-2xl bg-[var(--canvas)] p-5 text-[var(--muted)]">{t.history_empty}</p>:<ul className="mt-6 space-y-3">{history.registrations.map(registration=><li key={registration.id} className="rounded-2xl border border-[var(--border)] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-[var(--muted)]">{t.start}: {registration.startDate?new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeZone:'Europe/Berlin'}).format(new Date(`${registration.startDate}T12:00:00Z`)):'—'}</span><span className="rounded-full bg-[var(--canvas)] px-3 py-2 text-sm font-semibold">{t[registration.status]}</span></div><ul className="mt-3 space-y-2 font-semibold text-[var(--foreground)]">{registration.courses.map(course=><li key={course.id}>{courses[course.translationKey]?.title??course.title}</li>)}</ul></li>)}</ul>}
    </>}
  </section>
}
