import { requestSession } from '@/lib/request-session'
import { logout } from '@/app/actions/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LogOut, UserRound } from 'lucide-react'
import ThemeToggle from '@/components/layout/ThemeToggle'
import DashboardHeader from '@/components/layout/DashboardHeader'
import LearningResetSync from '@/components/layout/LearningResetSync'
import BrandLogo from '@/components/layout/BrandLogo'
import { getDictionary } from '@/lib/dictionary'
import { createDashboardTranslator, type DashboardTranslations } from '@/lib/dashboard-i18n'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const { supabase, user } = await requestSession()
  if (!user) redirect(`/${lang}/login`)
  const [{ data: profile }, dict] = await Promise.all([
    supabase.from('profiles').select('role,person:people(display_name)').eq('id', user.id).single(), getDictionary(lang),
  ])
  if (profile?.role === 'teacher' || profile?.role === 'admin') redirect(`/${lang}/admin`)
  const translations = dict.dashboard as DashboardTranslations
  const t = createDashboardTranslator(translations)
  return <div className="academy-student-shell">
    <LearningResetSync userId={user.id} />
    <header className="academy-student-header"><div className="academy-container">
      <div className="academy-student-toolbar"><Link href={`/${lang}/dashboard`} className="academy-brand-link"><span className="hidden sm:inline-flex"><BrandLogo name={dict.academy.brand_name} /></span><span className="sm:hidden"><BrandLogo name={dict.academy.brand_name} compact /></span></Link>
        <div className="flex min-w-0 items-center gap-2"><span className="hidden max-w-48 truncate text-sm lg:inline">{t('hello', {name: profile?.person?.display_name || user.email || ''})}</span><Link href={`/${lang}/dashboard/profile`} className="academy-icon-button" aria-label={t('open_profile_aria')} title={t('open_profile')}><UserRound size={20} aria-hidden="true" /></Link><ThemeToggle lightLabel={t('toggle_theme_light')} darkLabel={t('toggle_theme_dark')} /><form action={async () => { 'use server'; await logout(lang) }}><button type="submit" className="academy-icon-button" aria-label={t('logout_aria')} title={t('logout')}><LogOut size={19} aria-hidden="true" /><span className="hidden md:inline">{t('logout')}</span></button></form></div>
      </div><div className="academy-student-breadcrumb"><DashboardHeader lang={lang} translations={translations} breadcrumbLabel={dict.academy.breadcrumb} /></div>
    </div></header>
    <div className="academy-student-content academy-container">{children}</div>
  </div>
}
