import { getAdminStats } from '@/app/actions/admin'
import Link from 'next/link'
import { ArrowRight, CalendarDays, Users, BookOpen, Mic, FileText } from 'lucide-react'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'

export default async function AdminDashboardPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [stats, dict] = await Promise.all([getAdminStats(), getDictionary(lang)])
  const t = createAdminTranslator(dict.admin)
  const metrics = [
    { label: t('kpi_students'), value: stats.studentCount, href: `/${lang}/admin/students` },
    { label: t('kpi_activated'), value: stats.activatedCount, href: `/${lang}/admin/students` },
    { label: t('kpi_pending'), value: stats.pendingSubmissions, href: `/${lang}/admin/submissions` },
  ]
  const links = [
    { href: 'bookings', title: t('quick_bookings_title'), description: t('quick_bookings_desc'), Icon: CalendarDays },
    { href: 'students', title: t('quick_students_title'), description: t('quick_students_desc'), Icon: Users },
    { href: 'content/vocabulary', title: t('quick_vocab_title'), description: t('quick_vocab_desc'), Icon: BookOpen },
    { href: 'content/exercises', title: t('quick_exercises_title'), description: t('quick_exercises_desc'), Icon: FileText },
    { href: 'content/videos', title: t('quick_videos_title'), description: t('quick_videos_desc'), Icon: Mic },
  ]
  return (
    <div className="min-w-0 space-y-6 text-[var(--foreground)]">
      <header><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">{t('workspace_label')}</p><h1 className="text-2xl font-semibold tracking-tight">{t('welcome_title')}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{t('welcome_intro')}</p></header>
      <div className="grid gap-3 sm:grid-cols-3">{metrics.map(metric => <Link key={metric.label} href={metric.href} className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-muted)]"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm text-[var(--muted)]">{metric.label}</h2><ArrowRight size={16} aria-hidden="true" /></div><p className="text-3xl font-semibold tabular-nums">{metric.value}</p></Link>)}</div>
      <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]"><h2 className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm font-semibold">{t('quick_title')}</h2><div className="divide-y divide-[var(--border)]">{links.map(({ href, title, description, Icon }) => <Link key={href} href={`/${lang}/admin/${href}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-muted)]"><Icon size={19} className="shrink-0 text-[var(--muted)]" aria-hidden="true" /><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{description}</p></div><ArrowRight size={18} className="shrink-0" aria-hidden="true" /></Link>)}</div></section>
    </div>
  )
}
