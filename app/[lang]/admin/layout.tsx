import { logout } from '@/app/actions/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import ThemeToggle from '@/components/layout/ThemeToggle'
import AdminNav from '@/components/admin/AdminNav'
import { AdminI18nProvider } from '@/components/admin/AdminI18nProvider'
import { createClient } from '@/utils/supabase/server'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator, type AdminTranslations } from '@/lib/admin-i18n'

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

  return (
    <AdminI18nProvider translations={translations}>
      <div className="flex min-h-dvh flex-col bg-[#FCF4E6] transition-colors dark:bg-[#050505]">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex min-h-16 items-center justify-between gap-2 py-2">
              <div className="flex items-center gap-6">
                <Link href={`/${lang}/admin`} className="flex-shrink-0 items-center hover:opacity-80 transition-opacity">
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
                <div className="hidden lg:block">
                  <AdminNav lang={lang} />
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="hidden items-center text-sm font-medium text-slate-700 sm:inline-flex dark:text-slate-300">
                  {t('hello', { name: displayName })}
                  <span className="ml-2 inline-flex items-center rounded-full bg-[#FF5C00]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FF5C00] ring-1 ring-inset ring-[#FF5C00]/20">
                    {profile?.role === 'admin' ? t('role_badge_admin') : t('role_badge_teacher')}
                  </span>
                </span>
                <ThemeToggle />
                <form action={async () => {
                  'use server'
                  await logout(lang)
                }}>
                  <button
                    type="submit"
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    {t('logout')}
                  </button>
                </form>
              </div>
            </div>
            <div className="pb-3 lg:hidden">
              <AdminNav lang={lang} />
            </div>
          </div>
        </header>
        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </AdminI18nProvider>
  )
}
