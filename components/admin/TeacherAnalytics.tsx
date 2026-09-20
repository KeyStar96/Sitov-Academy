'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getTeacherAnalytics } from '@/app/actions/teacher-analytics'
import { teacherAnalyticsCopy } from '@/lib/teacher-analytics-i18n'
import type { AnalyticsOptions, TeacherAnalytics as AnalyticsData } from '@/lib/teacher-analytics'
import type { VocabularyTranslations } from '@/lib/vocabulary-i18n'
import PhaseDistributionChart from '@/components/vocabulary/PhaseDistributionChart'
import LearningHistoryChart from './LearningHistoryChart'

const control = 'min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base text-[var(--foreground)]'
const button = 'inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border)] px-4 py-2 font-semibold hover:bg-[var(--surface-muted)]'

export default function TeacherAnalytics({ options, failed, lang, translations }: {
  options: AnalyticsOptions; failed: boolean; lang: string; translations: VocabularyTranslations
}) {
  const t = teacherAnalyticsCopy(lang)
  const router = useRouter()
  const [studentId, setStudentId] = useState(options.students[0]?.id ?? '')
  const [courseId, setCourseId] = useState('')
  const [result, setResult] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(Boolean(studentId))
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!studentId) return
    let active = true
    setLoading(true); setError(false); setResult(null)
    getTeacherAnalytics({ studentId, courseId: courseId || null }).then(response => {
      if (!active) return
      if (response.success) setResult(response.data)
      else setError(true)
    }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [studentId, courseId, revision])
  const current = result?.studentId === studentId && result.courseId === (courseId || null) ? result : null
  const completion = current ? Object.entries(current.completionByLevel).filter(([level]) => !courseId || level === current.level) : []
  return <div className="min-w-0 space-y-6 text-[var(--foreground)]">
    <header><h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1><p className="mt-2 max-w-3xl text-[var(--muted)]">{t.intro}</p><Link href={`/${lang}/admin/courses`} className={`${button} mt-4`}>{t.manage}</Link></header>
    {failed ? <div role="alert" className="space-y-3 rounded-2xl border border-[var(--border)] p-5"><p>{t.failed}</p><button type="button" className={button} onClick={() => router.refresh()}>{t.retry}</button></div> : options.students.length === 0 ? <p>{t.empty}</p> : <>
      <div className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:grid-cols-2">
        <label className="grid min-w-0 gap-2 font-semibold"><span>{t.student}</span><select className={control} value={studentId} onChange={event => setStudentId(event.target.value)}>{options.students.map(student => <option key={student.id} value={student.id}>{student.name || `${t.unknown} (${student.id.slice(0, 8)})`}</option>)}</select></label>
        <label className="grid min-w-0 gap-2 font-semibold"><span>{t.course}</span><select className={control} value={courseId} onChange={event => setCourseId(event.target.value)}><option value="">{t.allCourses}</option>{options.courses.map(course => <option key={course.id} value={course.id}>{course.title}{course.level ? ` · ${course.level}` : ''}</option>)}</select></label>
        {courseId && <p className="text-sm leading-relaxed text-[var(--muted)] sm:col-span-2">{t.scope}</p>}
      </div>
      <div aria-live="polite" aria-busy={loading}>
        {loading && <p role="status">{t.loading}</p>}
        {error && <div role="alert" className="space-y-3"><p>{t.failed}</p><button type="button" className={button} onClick={() => setRevision(value => value + 1)}>{t.retry}</button></div>}
      </div>
      {current && !loading && (courseId && !current.level ? <p className="rounded-2xl border border-[var(--border)] p-5">{t.noLevel}</p> : <>
        {completion.length > 0 && <section aria-label={t.completion} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-xl font-semibold">{t.completion}</h2><dl className="mt-4 flex flex-wrap gap-6">{completion.map(([level, percent]) => <div key={level}><dt className="text-sm text-[var(--muted)]">{level}</dt><dd className="text-2xl font-semibold tabular-nums">{percent}%</dd></div>)}</dl></section>}
        <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
          <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5" aria-label={t.phases}><h2 className="text-xl font-semibold">{t.phases}</h2><p className="my-4 text-sm leading-relaxed text-[var(--muted)]">{t.phaseHint}</p><PhaseDistributionChart distribution={current.distribution} translations={translations} /></section>
          <LearningHistoryChart history={current.history} lang={lang} />
        </div>
      </>)}
    </>}
  </div>
}
