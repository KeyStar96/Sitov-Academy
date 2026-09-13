import { logout } from '@/app/actions/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import BrandLogo from '@/components/layout/BrandLogo'
import { LogOut } from 'lucide-react'
import ThemeToggle from '@/components/layout/ThemeToggle'
import HeaderLanguageSwitcher from '@/components/layout/HeaderLanguageSwitcher'
import AdminNav from '@/components/admin/AdminNav'
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

  return (
    <AdminI18nProvider translations={translations}>
      <div className="flex min-h-dvh min-w-0 flex-col bg-[var(--canvas)] text-[var(--foreground)]">
        <header className="z-20 border-b border-[var(--border)] bg-[var(--surface)] pt-[env(safe-area-inset-top)]">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <div className="flex min-h-16 w-full flex-wrap items-center justify-between gap-2 py-2">
              <Link
                href={`/${lang}/admin`}
                className="flex h-12 shrink-0 items-center rounded-xl px-1 transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
              >
                <BrandLogo name={t('brand_name')} />
              </Link>
              <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
                <span
                  className="hidden min-h-11 max-w-[9rem] items-center truncate border-l border-[var(--border)] px-3 text-xs font-medium text-[var(--muted)] md:inline-flex"
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
                    className="inline-flex h-12 min-w-12 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                    aria-label={t('logout_aria')}
                  >
                    <LogOut size={18} aria-hidden="true" />
                    <span className="hidden sm:inline">{t('logout')}</span>
                  </button>
                </form>
              </div>
            </div>
            <div className="border-t border-slate-100 py-2 dark:border-slate-800">
              <AdminNav lang={lang} />
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </main>
      </div>
    </AdminI18nProvider>
  )
}
