import { logout } from '@/app/actions/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import BrandLogo from '@/components/layout/BrandLogo'
import { LogOut } from 'lucide-react'
import ThemeToggle from '@/components/layout/ThemeToggle'
import HeaderLanguageSwitcher from '@/components/layout/HeaderLanguageSwitcher'
import TeacherLayout from '@/components/admin/TeacherLayout'
import { AdminI18nProvider } from '@/components/admin/AdminI18nProvider'
import { createClient } from '@/utils/supabase/server'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator, type AdminTranslations } from '@/lib/admin-i18n'
import { toUiLocale } from '@/lib/locale-routing'

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
    supabase.from('profiles').select('role,ui_language,person:people(display_name)').eq('id', user.id).single(),
    getDictionary(lang),
  ])

  if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
    redirect(`/${lang}/dashboard`)
  }

  const translations = (dict.admin ?? {}) as AdminTranslations
  const t = createAdminTranslator(translations)
  const displayName = profile?.person?.display_name || user.email || ''
  const roleLabel = profile?.role === 'admin' ? t('role_badge_admin') : t('role_badge_teacher')

  const brand = (
    <Link
      href={`/${lang}/admin`}
      className="flex h-12 min-w-0 shrink-0 items-center rounded-xl px-1 transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      <BrandLogo name={t('brand_name')} />
    </Link>
  )

  const compactBrand = (
    <Link
      href={`/${lang}/admin`}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      <BrandLogo name={t('brand_name')} compact />
    </Link>
  )

  const controls = (
    <>
      <span
        className="hidden min-h-11 max-w-[9rem] items-center truncate rounded-md border border-[var(--border)] px-3 text-xs font-medium text-[var(--muted)] md:inline-flex"
        title={displayName}
      >
        {roleLabel}
      </span>
      <HeaderLanguageSwitcher current={toUiLocale(profile?.ui_language ?? lang)} ariaLabel={t('ui_language_aria')} />
      <ThemeToggle lightLabel={t('toggle_theme_light')} darkLabel={t('toggle_theme_dark')} />
      <form action={async () => {
        'use server'
        await logout(lang)
      }}>
        <button
          type="submit"
          className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--foreground)] shadow-sm transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          aria-label={t('logout_aria')}
        >
          <LogOut size={18} aria-hidden="true" />
          <span className="hidden sm:inline">{t('logout')}</span>
        </button>
      </form>
    </>
  )

  return (
    <AdminI18nProvider translations={translations}>
      <TeacherLayout lang={lang} brand={brand} compactBrand={compactBrand} controls={controls}>
        {children}
      </TeacherLayout>
    </AdminI18nProvider>
  )
}
