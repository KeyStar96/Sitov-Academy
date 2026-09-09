import { getAdminStats } from '@/app/actions/admin'
import Link from 'next/link'
import { Users, Unlock, Mic, ArrowRight, LayoutDashboard, PlusCircle, CalendarDays } from 'lucide-react'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'

export default async function AdminDashboardPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [stats, dict] = await Promise.all([getAdminStats(), getDictionary(lang)])
  const t = createAdminTranslator(dict.admin)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('welcome_title')}</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{t('welcome_intro')}</p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('kpi_students')}</h3>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
              <Users size={24} aria-hidden="true" />
            </div>
          </div>
          <div className="text-4xl font-black text-slate-900 dark:text-white">{stats.studentCount}</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('kpi_activated')}</h3>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
              <Unlock size={24} aria-hidden="true" />
            </div>
          </div>
          <div className="text-4xl font-black text-slate-900 dark:text-white">{stats.activatedCount}</div>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="absolute top-0 right-0 h-32 w-32 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FF5C00] opacity-10 blur-[60px]" />
          <div className="relative z-10 mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('kpi_pending')}</h3>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF5C00]/10 text-[#FF5C00]">
              <Mic size={24} aria-hidden="true" />
            </div>
          </div>
          <div className="relative z-10 text-4xl font-black text-slate-900 dark:text-white">{stats.pendingSubmissions}</div>
          {stats.pendingSubmissions > 0 && (
            <Link href={`/${lang}/admin/submissions`} className="relative z-10 mt-4 flex min-h-12 items-center gap-2 text-sm font-bold text-[#FF5C00] hover:text-[#e05200]">
              {t('correct_now')} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
      <div>
        <h2 className="mb-6 text-xl font-bold text-slate-900 dark:text-white">{t('quick_title')}</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link href={`/${lang}/admin/students`} className="group rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-[#FF5C00] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-[#FF5C00]">
            <Users className="mb-3 text-slate-400 transition-colors group-hover:text-[#FF5C00]" size={32} aria-hidden="true" />
            <h3 className="font-bold text-slate-900 dark:text-white">{t('quick_students_title')}</h3>
            <p className="mt-1 text-sm text-slate-500">{t('quick_students_desc')}</p>
          </Link>
          <Link href={`/${lang}/admin/bookings`} className="group rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-[#FF5C00] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-[#FF5C00]">
            <CalendarDays className="mb-3 text-slate-400 transition-colors group-hover:text-[#FF5C00]" size={32} aria-hidden="true" />
            <h3 className="font-bold text-slate-900 dark:text-white">{t('quick_bookings_title')}</h3>
            <p className="mt-1 text-sm text-slate-500">{t('quick_bookings_desc')}</p>
          </Link>
          <Link href={`/${lang}/admin/content/vocabulary`} className="group rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-[#FF5C00] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-[#FF5C00]">
            <LayoutDashboard className="mb-3 text-slate-400 transition-colors group-hover:text-[#FF5C00]" size={32} aria-hidden="true" />
            <h3 className="font-bold text-slate-900 dark:text-white">{t('quick_vocab_title')}</h3>
            <p className="mt-1 text-sm text-slate-500">{t('quick_vocab_desc')}</p>
          </Link>
          <Link href={`/${lang}/admin/content/exercises`} className="group rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-[#FF5C00] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-[#FF5C00]">
            <PlusCircle className="mb-3 text-slate-400 transition-colors group-hover:text-[#FF5C00]" size={32} aria-hidden="true" />
            <h3 className="font-bold text-slate-900 dark:text-white">{t('quick_exercises_title')}</h3>
            <p className="mt-1 text-sm text-slate-500">{t('quick_exercises_desc')}</p>
          </Link>
          <Link href={`/${lang}/admin/content/videos`} className="group rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-[#FF5C00] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-[#FF5C00]">
            <Mic className="mb-3 text-slate-400 transition-colors group-hover:text-[#FF5C00]" size={32} aria-hidden="true" />
            <h3 className="font-bold text-slate-900 dark:text-white">{t('quick_videos_title')}</h3>
            <p className="mt-1 text-sm text-slate-500">{t('quick_videos_desc')}</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
