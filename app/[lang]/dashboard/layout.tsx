import { requestSession } from '@/lib/request-session'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { UserRound } from 'lucide-react'
import ThemeToggle from '@/components/layout/ThemeToggle'
import DashboardHeader from '@/components/layout/DashboardHeader'
import LearningResetSync from '@/components/layout/LearningResetSync'
import BrandLogo from '@/components/layout/BrandLogo'
import LogoutButton from '@/components/dashboard/LogoutButton'
import StudentNavigation from '@/components/dashboard/StudentNavigation'
import { getDictionary } from '@/lib/dictionary'
import { createDashboardTranslator, type DashboardTranslations } from '@/lib/dashboard-i18n'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { ACCESS_LEVELS, hasLevelAccess } from '@/lib/access/levels'
import { studentTranslator } from '@/lib/student-ui-i18n'
import '@/components/dashboard/student.css'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const { supabase, user } = await requestSession()
  if (!user) redirect(`/${lang}/login`)
  const [{ data: profile }, dict, access] = await Promise.all([
    supabase.from('profiles').select('role,person:people(display_name)').eq('id', user.id).single(), getDictionary(lang),
    loadLevelAccessProfile(supabase, user.id),
  ])
  if (profile?.role === 'teacher' || profile?.role === 'admin') redirect(`/${lang}/admin`)
  const translations = dict.dashboard as DashboardTranslations
  const t = createDashboardTranslator(translations)
  const s = studentTranslator(lang)
  const levels = ACCESS_LEVELS.filter(level => hasLevelAccess(access, level))
  const supportLabels = {
    whatsapp: dict.academy.support_whatsapp,
    phone: dict.Footer.Contact.phone,
    phoneLabel: dict.Footer.Contact.phone_label,
    telegram: dict.Footer.Contact.telegram_button,
    email: dict.Footer.Contact.email,
    emailLabel: dict.Footer.Contact.email_button,
  }
  return <div className="academy-student-shell">
    <LearningResetSync userId={user.id} />
    <header className="academy-student-header"><div className="academy-container">
      <div className="academy-student-toolbar"><Link href={`/${lang}/dashboard`} className="academy-brand-link"><span className="hidden sm:inline-flex"><BrandLogo name={dict.academy.brand_name} /></span><span className="sm:hidden"><BrandLogo name={dict.academy.brand_name} compact /></span></Link>
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <span className="hidden max-w-48 truncate text-sm lg:inline">{t('hello', { name: profile?.person?.display_name || user.email || '' })}</span>
          <Link href={`/${lang}/dashboard/profile`} className="st-toolbar-button st-press" aria-label={t('open_profile_aria')}><UserRound size={21} aria-hidden="true" /><span aria-hidden="true">{s('nav_profile')}</span></Link>
          <ThemeToggle lightLabel={t('toggle_theme_light')} darkLabel={t('toggle_theme_dark')} label={s('settings_appearance')} />
          <LogoutButton lang={lang} />
        </div>
      </div><div className="academy-student-breadcrumb"><DashboardHeader lang={lang} translations={translations} breadcrumbLabel={dict.academy.breadcrumb} /></div>
    </div></header>
    <div className="academy-student-content academy-container">{children}</div>
    <StudentNavigation lang={lang} firstLevel={levels[0] ?? null} levels={levels} supportLabels={supportLabels} />
  </div>
}
