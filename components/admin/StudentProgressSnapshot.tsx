'use client'

import Link from 'next/link'
import { ChartNoAxesColumn } from 'lucide-react'
import TrendChart, { ChartLegend, type ChartSeries } from '@/components/charts/TrendChart'
import AccuracyRing from '@/components/charts/AccuracyRing'
import { answeredOn, todaySummary, type LearningProgress } from '@/lib/learning-progress'
import { formatStudyTime, learningProgressCopy } from '@/lib/learning-progress-i18n'
import { adminButton } from './ui'

/**
 * Schülerprofil → Überblick: die Tageswerte (beantwortet, richtig, Prozent)
 * und die letzten sieben Tage auf einen Blick, mit Sprung in die Lernanalyse.
 */
export default function StudentProgressSnapshot({ progress, lang }: { progress: LearningProgress; lang: string }) {
  const t = learningProgressCopy(lang)
  const today = todaySummary(progress.daily)!
  const series: ChartSeries[] = [
    { key: 'correct', label: t('correct'), color: 'var(--success)', type: 'bar', stack: 'answers' },
    { key: 'wrong', label: t('wrong'), color: 'var(--danger)', type: 'bar', stack: 'answers', opacity: 0.55 },
    { key: 'percent', label: t('accuracy'), color: 'var(--violet)', type: 'line', axis: 'percent' },
  ]
  const points = progress.daily.map(day => { const value = answeredOn(day); return { date: day.date, values: { correct: value.correct, wrong: value.wrong, percent: value.percent } } })
  const number = (value: number) => new Intl.NumberFormat(lang).format(value)
  return <section className="min-w-0 rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-4 sm:p-5" aria-labelledby="student-progress-snapshot">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="student-progress-snapshot" className="text-sm font-semibold">{t('snapshot_title')}</h2>
      <Link href={`/${lang}/admin/analytics?student=${progress.studentId}`} className={adminButton('secondary', 'sm')}><ChartNoAxesColumn size={16} aria-hidden="true" />{t('snapshot_link')}</Link>
    </div>
    <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
      <div className="flex items-center gap-4">
        <AccuracyRing value={today.percent} label={today.percent === null ? t('accuracy_none') : t('accuracy_aria', { value: today.percent })} size={76} />
        <dl className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm">
          <dt className="text-[var(--muted)]">{t('answered')}</dt><dt className="text-[var(--muted)]">{t('correct')}</dt><dt className="text-[var(--muted)]">{t('study_time')}</dt>
          <dd className="text-lg font-semibold tabular-nums">{number(today.answers)}</dd>
          <dd className="text-lg font-semibold tabular-nums text-[var(--success)]">{number(today.correct)}</dd>
          <dd className="text-lg font-semibold tabular-nums">{formatStudyTime(today.seconds, t)}</dd>
        </dl>
      </div>
      <div className="min-w-0"><ChartLegend series={series} />
        <div className="mt-1"><TrendChart points={points} series={series} lang={lang} label={t('snapshot_title')} height={150} emptyLabel={t('empty_chart')} /></div></div>
    </div>
  </section>
}
