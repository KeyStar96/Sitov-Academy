import { logout } from '@/app/actions/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import BrandLogo from '@/components/layout/BrandLogo'
import { LogOut, ShieldCheck } from 'lucide-react'
import ThemeToggle from '@/components/layout/ThemeToggle'
import HeaderLanguageSwitcher from '@/components/layout/HeaderLanguageSwitcher'
import TeacherLayout from '@/components/admin/TeacherLayout'
import { AdminI18nProvider } from '@/components/admin/AdminI18nProvider'
import { adminButton, adminFocus } from '@/components/admin/ui'
import { getAdminNavCounts } from '@/app/actions/admin'
import { createClient } from '@/utils/supabase/server'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator, type AdminTranslations } from '@/lib/admin-i18n'
import { toUiLocale } from '@/lib/locale-routing'
import { requireSitovStaffMfa } from '@/lib/sitov-staff-mfa'
import { sitovStaffMfaCopy } from '@/lib/sitov-staff-mfa-copy'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/${lang}/login`)
  }

  const [{ data: profile }, dict] = await Promise.all([
    supabase.from('profiles').select('role,sitov_mfa_required,ui_language,person:people(display_name)').eq('id', user.id).single(),
    getDictionary(lang),
  ])

  if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
    redirect(`/${lang}/dashboard`)
  }
  try { await requireSitovStaffMfa(supabase, profile) }
  catch { redirect(`/${lang}/staff-security`) }

  const counts = await getAdminNavCounts()
  const translations = (dict.admin ?? {}) as AdminTranslations
  const t = createAdminTranslator(translations)
  const displayName = profile?.person?.display_name || user.email || ''
  const roleLabel = profile?.role === 'admin' ? t('role_badge_admin') : t('role_badge_teacher')

  const brand = (
    <Link href={`/${lang}/admin`} className={`flex h-12 min-w-0 shrink-0 items-center rounded-lg px-1 transition-opacity hover:opacity-80 ${adminFocus}`}>
      <BrandLogo name={t('brand_name')} />
    </Link>
  )

  const compactBrand = (
    <Link href={`/${lang}/admin`} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-opacity hover:opacity-80 ${adminFocus}`}>
      <BrandLogo name={t('brand_name')} compact />
    </Link>
  )

  const controls = (
    <>
      <HeaderLanguageSwitcher current={toUiLocale(profile?.ui_language ?? lang)} ariaLabel={t('ui_language_aria')} />
      <ThemeToggle lightLabel={t('toggle_theme_light')} darkLabel={t('toggle_theme_dark')} />
      <Link href={`/${lang}/staff-security`} className={adminButton('secondary', 'md')} aria-label={sitovStaffMfaCopy(lang).title}>
        <ShieldCheck size={17} aria-hidden="true" />
      </Link>
      <form action={async () => {
        'use server'
        await logout(lang)
      }}>
        <button type="submit" className={adminButton('secondary', 'md')} aria-label={t('logout_aria')}>
          <LogOut size={17} aria-hidden="true" />
          <span>{t('logout')}</span>
        </button>
      </form>
    </>
  )

  return (
    <AdminI18nProvider translations={translations}>
      <TeacherLayout
        lang={lang}
        brand={brand}
        compactBrand={compactBrand}
        controls={controls}
        account={{ name: displayName, role: roleLabel }}
        counts={counts}
      >
        {children}
      </TeacherLayout>
    </AdminI18nProvider>
  )
}
