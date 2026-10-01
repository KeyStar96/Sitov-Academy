import Link from 'next/link'
import { ChevronRight, Target } from 'lucide-react'
import AccuracyRing from '@/components/charts/AccuracyRing'
import { answeredOn, todaySummary, type LearningProgress } from '@/lib/learning-progress'
import { formatStudyTime, learningProgressCopy } from '@/lib/learning-progress-i18n'

/**
 * Startseite: der heutige Tag in Zahlen (beantwortet, richtig, Prozent), die
 * letzten sieben Tage als Mini-Balken und – falls fällig – der Weg zu den
 * Problemwörtern. Führt zu „Mein Fortschritt".
 */
export default function ProgressTeaser({ progress, lang, focus }: {
  progress: LearningProgress
  lang: string
  /** Fällige Problemwörter des empfohlenen Niveaus und der Weg dorthin. */
  focus: { href: string; due: number } | null
}) {
  const t = learningProgressCopy(lang)
  const today = todaySummary(progress.daily)!
  const week = progress.daily.slice(-7).map(day => ({ date: day.date, ...answeredOn(day) }))
  const maximum = Math.max(1, ...week.map(day => day.answers))
  const weekday = (date: string) => new Intl.DateTimeFormat(lang, { weekday: 'narrow', timeZone: 'Europe/Berlin' }).format(new Date(`${date}T12:00:00Z`))
  const number = (value: number) => new Intl.NumberFormat(lang).format(value)
  return <section className="rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5" aria-labelledby="progress-teaser-title">
    <h2 id="progress-teaser-title" className="text-lg font-bold text-[var(--foreground)]">{t('teaser_title')}</h2>
    <div className="mt-3 flex items-center gap-4">
      <AccuracyRing value={today.percent} label={today.percent === null ? t('accuracy_none') : t('accuracy_aria', { value: today.percent })} size={88} />
      <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-2">
        <div><dt className="text-sm font-semibold text-[var(--muted)]">{t('answered')}</dt><dd className="text-2xl font-bold tabular-nums">{number(today.answers)}</dd></div>
        <div><dt className="text-sm font-semibold text-[var(--muted)]">{t('correct')}</dt><dd className="text-2xl font-bold tabular-nums text-[var(--success)]">{number(today.correct)}</dd></div>
        <div className="col-span-2"><dt className="sr-only">{t('study_time')}</dt><dd className="text-sm text-[var(--muted)]">{t('study_time')}: {formatStudyTime(today.seconds, t)}</dd></div>
      </dl>
    </div>
    {today.answers === 0 && <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">{t('teaser_empty')}</p>}
    <ol className="mt-4 grid grid-cols-7 items-end gap-1.5" aria-label={t('overview_title')}>
      {week.map(day => <li key={day.date} className="flex flex-col items-center gap-1">
        <span className="flex h-14 w-full items-end overflow-hidden rounded-md bg-[var(--surface-muted)]" aria-hidden="true">
          <span className="w-full rounded-md bg-[var(--success)]" style={{ height: `${day.answers ? Math.max(8, day.answers / maximum * 100) : 0}%`, opacity: day.percent === null ? 0 : 0.45 + day.percent / 200 }} />
        </span>
        <span className="text-xs font-semibold text-[var(--muted)]" aria-hidden="true">{weekday(day.date)}</span>
        <span className="sr-only">{new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'Europe/Berlin' }).format(new Date(`${day.date}T12:00:00Z`))}: {t('answered')} {day.answers}, {day.percent === null ? t('accuracy_none') : t('accuracy_aria', { value: day.percent })}</span>
      </li>)}
    </ol>
    <div className="mt-4 flex flex-wrap gap-2">
      <Link href={`/${lang}/dashboard/progress`} className="st-link-pill st-press">{t('progress_link')}<ChevronRight size={18} aria-hidden="true" /></Link>
      {focus && focus.due > 0 && <Link href={focus.href} className="st-link-pill st-press"><Target size={18} aria-hidden="true" />{t('focus_cta')} ({number(focus.due)})</Link>}
    </div>
  </section>
}
