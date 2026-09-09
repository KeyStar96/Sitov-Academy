import { createClient } from '@/utils/supabase/server'
import { logout } from '@/app/actions/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import ThemeToggle from '@/components/layout/ThemeToggle'
import AdminNav from '@/components/admin/AdminNav'

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

  // Profil-Daten laden (für Name und Rolle)
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Nur Lehrer oder Admins haben Zugriff
  if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
    redirect(`/${lang}/dashboard`)
  }

  return (
    <div className="min-h-dvh bg-[#FCF4E6] dark:bg-[#050505] flex flex-col transition-colors">
      <header className="bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 transition-colors">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 justify-between items-center gap-2 py-2">
            <div className="flex items-center gap-6">
              <Link href={`/${lang}/admin`} className="flex-shrink-0 items-center block hover:opacity-80 transition-opacity">
                <Image
                  src="/Bilder/SG_Logo_Lightmode.png"
                  alt="Sitov Language Academy"
                  width={240}
                  height={48}
                  className="h-7 md:h-8 w-auto object-contain dark:hidden"
                  priority
                />
                <Image
                  src="/Bilder/SG_Logo_Darkmode3.png"
                  alt="Sitov Language Academy"
                  width={240}
                  height={48}
                  className="h-7 md:h-8 w-auto object-contain hidden dark:block"
                  priority
                />
              </Link>
              <div className="hidden lg:block">
                <AdminNav lang={lang} />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:inline-flex items-center">
                Hallo, {profile?.name || user.email} 
                <span className="ml-2 inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset bg-[#FF5C00]/10 text-[#FF5C00] ring-[#FF5C00]/20">
                  {profile?.role === 'admin' ? 'Admin' : 'Teacher'}
                </span>
              </span>
              
              <ThemeToggle />

              <form action={async () => {
                'use server'
                await logout(lang)
              }}>
                <button
                  type="submit"
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-white dark:bg-slate-800 px-4 text-sm font-bold text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Abmelden
                </button>
              </form>
            </div>
          </div>
          
          <div className="lg:hidden pb-3">
            <AdminNav lang={lang} />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl py-8 px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
