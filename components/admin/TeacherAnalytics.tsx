'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserRound } from 'lucide-react'
import { getStudentLearningProgress } from '@/app/actions/learning-progress'
import { teacherAnalyticsCopy } from '@/lib/teacher-analytics-i18n'
import { learningProgressCopy } from '@/lib/learning-progress-i18n'
import { PROGRESS_RANGES, type LearningProgress, type ProgressRange } from '@/lib/learning-progress'
import type { AnalyticsOptions } from '@/lib/teacher-analytics'
import type { VocabularyTranslations } from '@/lib/vocabulary-i18n'
import LearningProgressView from '@/components/progress/LearningProgressView'
import { Notice, PageHeader, adminButton, adminChip, adminInput, adminLabel } from './ui'

/**
 * Lernanalyse der Lehrkraft (Phase 11.3): Schüler, Trainer-Niveau und Zeitraum
 * wählen; darunter Tageswerte mit Prozent, Verlauf und Fortschritt je
 * Lernmodus. Beim Wechsel bleiben die alten Werte blass sichtbar, bis die
 * neuen da sind – eine langsamere ältere Antwort überschreibt nie eine neuere.
 */
export default function TeacherAnalytics({ options, failed, lang, translations, initialStudentId, initialDays = 30 }: {
  options: AnalyticsOptions
  failed: boolean
  lang: string
  translations: VocabularyTranslations
  /** Vorauswahl aus dem Schülerprofil (`?student=`). */
  initialStudentId?: string | null
  initialDays?: ProgressRange
}) {
  const t = teacherAnalyticsCopy(lang)
  const p = learningProgressCopy(lang)
  const router = useRouter()
  const preselected = options.students.some(student => student.id === initialStudentId) ? initialStudentId! : options.students[0]?.id ?? ''
  const [studentId, setStudentId] = useState(preselected)
  const [level, setLevel] = useState('')
  const [days, setDays] = useState<ProgressRange>(initialDays)
  const [result, setResult] = useState<LearningProgress | null>(null)
  const [loading, setLoading] = useState(Boolean(studentId))
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!studentId) return
    let active = true
    setLoading(true); setError(false)
    getStudentLearningProgress({ studentId, level: level || null, days }).then(response => {
      if (!active) return
      if (response.success) setResult(response.data)
      else { setResult(null); setError(true) }
    }).catch(() => { if (active) { setResult(null); setError(true) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [studentId, level, days, revision])
  const matches = result?.studentId === studentId
  const retry = (onClick: () => void) => <button type="button" className={adminButton('secondary', 'sm')} onClick={onClick}>{t.retry}</button>
  return <div className="min-w-0 space-y-5 text-[var(--foreground)] sm:space-y-6">
    <PageHeader title={t.title} description={t.intro} />
    {failed ? <Notice tone="warning" role="alert" action={retry(() => router.refresh())}>{t.failed}</Notice> : options.students.length === 0 ? <p className="text-sm text-[var(--muted)]">{t.empty}</p> : <>
      <div className="grid gap-4 rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto]">
        <label className="block min-w-0"><span className={adminLabel}>{t.student}</span>
          <select className={adminInput} value={studentId} onChange={event => { setStudentId(event.target.value); setResult(null) }}>
            {options.students.map(student => <option key={student.id} value={student.id}>{student.name || `${t.unknown} (${student.id.slice(0, 8)})`}</option>)}
          </select></label>
        <label className="block min-w-0"><span className={adminLabel}>{t.level}</span>
          <select className={adminInput} value={level} onChange={event => setLevel(event.target.value)}>
            <option value="">{t.allLevels}</option>{options.levels.map(item => <option key={item.code} value={item.code}>{item.code}</option>)}
          </select></label>
        <fieldset className="min-w-0 sm:col-span-2 xl:col-span-1">
          <legend className={adminLabel}>{p('range')}</legend>
          <div className="flex flex-wrap gap-2">{PROGRESS_RANGES.map(range => <button key={range} type="button" aria-pressed={days === range}
            className={adminChip(days === range)} onClick={() => setDays(range)}>{p('range_days', { count: range })}</button>)}</div>
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 xl:col-span-3">
          <p className="min-w-0 text-sm leading-relaxed text-[var(--muted)]">{level ? t.scope : t.scopeAll}</p>
          {studentId && <Link href={`/${lang}/admin/students/${studentId}`} className={adminButton('ghost', 'sm')}><UserRound size={16} aria-hidden="true" />{t.openProfile}</Link>}
        </div>
      </div>
      <div aria-live="polite" aria-busy={loading}>
        {loading && !matches && <p role="status" className="text-sm text-[var(--muted)]">{t.loading}</p>}
        {error && <Notice tone="warning" role="alert" action={retry(() => setRevision(value => value + 1))}>{t.failed}</Notice>}
      </div>
      {matches && result && <div className={loading ? 'opacity-60 transition-opacity motion-reduce:transition-none' : 'transition-opacity motion-reduce:transition-none'}>
        <LearningProgressView progress={result} lang={lang} skin="admin" translations={translations} audience="teacher" />
      </div>}
    </>}
  </div>
}
