'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getTeacherAnalytics } from '@/app/actions/teacher-analytics'
import { teacherAnalyticsCopy } from '@/lib/teacher-analytics-i18n'
import type { AnalyticsOptions, TeacherAnalytics as AnalyticsData } from '@/lib/teacher-analytics'
import type { VocabularyTranslations } from '@/lib/vocabulary-i18n'
import PhaseDistributionChart from '@/components/vocabulary/PhaseDistributionChart'
import LearningHistoryChart from './LearningHistoryChart'
import { Notice, PageHeader, adminButton, adminInput, adminLabel } from './ui'

export default function TeacherAnalytics({ options, failed, lang, translations }: {
  options: AnalyticsOptions; failed: boolean; lang: string; translations: VocabularyTranslations
}) {
  const t = teacherAnalyticsCopy(lang)
  const router = useRouter()
  const [studentId, setStudentId] = useState(options.students[0]?.id ?? '')
  const [level, setLevel] = useState('')
  const [result, setResult] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(Boolean(studentId))
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!studentId) return
    let active = true
    setLoading(true); setError(false); setResult(null)
    getTeacherAnalytics({ studentId, level: level || null }).then(response => {
      if (!active) return
      if (response.success) setResult(response.data)
      else setError(true)
    }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [studentId, level, revision])
  const current = result?.studentId === studentId && result.level === (level || null) ? result : null
  const completion = current ? Object.entries(current.completionByLevel).filter(([code]) => !level || code === level) : []
  const retry = (onClick: () => void) => <button type="button" className={adminButton('secondary', 'sm')} onClick={onClick}>{t.retry}</button>
  // Kursverwaltung gehört nicht mehr zur Lernanalyse – sie liegt im Bereich „Kurse“.
  return <div className="min-w-0 space-y-5 text-[var(--foreground)] sm:space-y-6">
    <PageHeader title={t.title} description={t.intro} />
    {failed ? <Notice tone="warning" role="alert" action={retry(() => router.refresh())}>{t.failed}</Notice> : options.students.length === 0 ? <p className="text-sm text-[var(--muted)]">{t.empty}</p> : <>
      <div className="grid gap-4 rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-4 sm:grid-cols-2 sm:p-5">
        <label className="block min-w-0"><span className={adminLabel}>{t.student}</span><select className={adminInput} value={studentId} onChange={event => setStudentId(event.target.value)}>{options.students.map(student => <option key={student.id} value={student.id}>{student.name || `${t.unknown} (${student.id.slice(0, 8)})`}</option>)}</select></label>
        <label className="block min-w-0"><span className={adminLabel}>{t.level}</span><select className={adminInput} value={level} onChange={event => setLevel(event.target.value)}><option value="">{t.allLevels}</option>{options.levels.map(item => <option key={item.code} value={item.code}>{item.code}</option>)}</select></label>
        {level && <p className="text-sm leading-relaxed text-[var(--muted)] sm:col-span-2">{t.scope}</p>}
      </div>
      <div aria-live="polite" aria-busy={loading}>
        {loading && <p role="status" className="text-sm text-[var(--muted)]">{t.loading}</p>}
        {error && <Notice tone="warning" role="alert" action={retry(() => setRevision(value => value + 1))}>{t.failed}</Notice>}
      </div>
      {current && !loading && <>
        {completion.length > 0 && <section aria-label={t.completion} className="space-y-3"><h2 className="text-sm font-semibold">{t.completion}</h2><dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{completion.map(([code, percent]) => <div key={code} className="min-w-0 rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-4"><dt className="text-[0.8125rem] font-medium text-[var(--muted)]">{code}</dt><dd className="mt-2 text-2xl font-semibold leading-none tabular-nums">{percent}%</dd></div>)}</dl></section>}
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
          <section className="min-w-0 rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-4 sm:p-5" aria-label={t.phases}><h2 className="text-sm font-semibold">{t.phases}</h2><p className="my-3 text-sm leading-relaxed text-[var(--muted)]">{t.phaseHint}</p><PhaseDistributionChart distribution={current.distribution} translations={translations} /></section>
          <LearningHistoryChart history={current.history} lang={lang} />
        </div>
      </>}
    </>}
  </div>
}
