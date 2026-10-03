import { requestSession } from '@/lib/request-session'
import { redirect } from 'next/navigation'
import LearningResetSync from '@/components/layout/LearningResetSync'
import SitovLearningShell from '@/components/layout/SitovLearningShell'
import { loadLastActiveLevel } from '@/lib/last-active-level'
import { loadLearningNewCounts } from '@/lib/learning-new-server'
import { getDictionary } from '@/lib/dictionary'
import { type DashboardTranslations } from '@/lib/dashboard-i18n'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { ACCESS_LEVELS, hasLevelAccess } from '@/lib/access/levels'
import '@/components/dashboard/student.css'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const { supabase, user } = await requestSession()
  if (!user) redirect(`/${lang}/login`)
  const [{ data: profile }, dict, access, lastActive, news] = await Promise.all([
    supabase.from('profiles').select('role,person:people(display_name)').eq('id', user.id).single(), getDictionary(lang),
    loadLevelAccessProfile(supabase, user.id), loadLastActiveLevel(), loadLearningNewCounts(),
  ])
  if (profile?.role === 'teacher' || profile?.role === 'admin') redirect(`/${lang}/admin`)
  const translations = dict.dashboard as DashboardTranslations
  const levels = ACCESS_LEVELS.filter(level => hasLevelAccess(access, level))
  const supportLabels = {
    whatsapp: dict.academy.support_whatsapp,
    phone: dict.Footer.Contact.phone,
    phoneLabel: dict.Footer.Contact.phone_label,
    telegram: dict.Footer.Contact.telegram_button,
    email: dict.Footer.Contact.email,
    emailLabel: dict.Footer.Contact.email_button,
  }
  return <SitovLearningShell lang={lang} translations={translations} displayName={profile?.person?.display_name || user.email || ''}
    levels={levels} supportLabels={supportLabels} breadcrumbLabel={dict.academy.breadcrumb}
    lastActiveLevel={lastActive ? lastActive.level : undefined} learnNew={news?.any === true}>
    <LearningResetSync userId={user.id} />
    {children}
  </SitovLearningShell>
}
