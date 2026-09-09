import { logout } from '@/app/actions/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import Image from 'next/image'
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
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    getDictionary(lang),
  ])

  if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
    redirect(`/${lang}/dashboard`)
  }

  const translations = (dict.admin ?? {}) as AdminTranslations
  const t = createAdminTranslator(translations)
  const displayName = profile?.name || user.email || ''
  const roleLabel = profile?.role === 'admin' ? t('role_badge_admin') : t('role_badge_teacher')

  return (
    <AdminI18nProvider translations={translations}>
      <div className="flex min-h-dvh flex-col bg-[#FCF4E6] transition-colors dark:bg-[#050505]">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)] transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex min-h-16 w-full items-center justify-between gap-3 py-2">
              <Link
                href={`/${lang}/admin`}
                className="flex h-12 shrink-0 items-center rounded-xl px-1 transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
              >
                <Image
                  src="/Bilder/SG_Logo_Lightmode.png"
                  alt="Sitov Language Academy"
                  width={240}
                  height={48}
                  className="h-7 w-auto object-contain dark:hidden md:h-8"
                  priority
                />
                <Image
                  src="/Bilder/SG_Logo_Darkmode3.png"
                  alt="Sitov Language Academy"
                  width={240}
                  height={48}
                  className="hidden h-7 w-auto object-contain dark:block md:h-8"
                  priority
                />
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className="hidden h-12 max-w-[9rem] items-center truncate rounded-2xl bg-[#FF5C00]/10 px-3 text-[10px] font-bold uppercase tracking-wider text-[#FF5C00] ring-1 ring-inset ring-[#FF5C00]/20 sm:inline-flex"
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
                    className="inline-flex h-12 min-w-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
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
        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </main>
      </div>
    </AdminI18nProvider>
  )
}
