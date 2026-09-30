'use client'

import type { TeacherAnalytics } from '@/lib/teacher-analytics'
import { teacherAnalyticsCopy } from '@/lib/teacher-analytics-i18n'

export default function LearningHistoryChart({ history, lang }: { history: TeacherAnalytics['history']; lang: string }) {
  const t = teacherAnalyticsCopy(lang)
  const maximum = Math.max(1, ...history.map(day => day.answers))
  const totals = history.reduce((sum, day) => ({ answers: sum.answers + day.answers, correct: sum.correct + day.correct }), { answers: 0, correct: 0 })
  const date = (value: string) => new Intl.DateTimeFormat(lang, { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(`${value}T12:00:00Z`))
  const points = (key: 'answers' | 'correct') => history.map((day, index) => `${24 + index * 552 / Math.max(1, history.length - 1)},${176 - day[key] / maximum * 152}`).join(' ')
  return <section className="min-w-0 rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-4 sm:p-5" aria-label={t.history}>
    <h2 className="text-sm font-semibold">{t.history}</h2>
    <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{t.historyHint}</p>
    <dl className="my-4 grid grid-cols-2 gap-3">{(['answers', 'correct'] as const).map(key => <div key={key} className="rounded-lg bg-[var(--surface-muted)] p-3"><dt className="text-xs text-[var(--muted)]">{t[key]}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{totals[key]}</dd></div>)}</dl>
    {totals.answers === 0 ? <p className="rounded-lg bg-[var(--surface-muted)] p-4 text-sm">{t.noHistory}</p> : <>
      <div className="flex flex-wrap gap-4 text-sm" aria-hidden="true"><span className="text-[var(--accent-text)]">━ {t.answers}</span><span className="text-[var(--success)]">┄ {t.correct}</span></div>
      <svg viewBox="0 0 600 200" className="mt-2 w-full" aria-hidden="true" focusable="false">
        <line x1="24" y1="176" x2="576" y2="176" stroke="var(--admin-line-strong)" />
        <line x1="24" y1="24" x2="576" y2="24" stroke="var(--admin-line)" strokeDasharray="3 5" />
        <text x="24" y="17" fill="var(--muted)" fontSize="12">{maximum}</text>
        <polyline points={points('answers')} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
        <polyline points={points('correct')} fill="none" stroke="var(--success)" strokeWidth="2.5" strokeDasharray="6 4" strokeLinejoin="round" />
        <text x="24" y="196" fill="var(--muted)" fontSize="12">{date(history[0].date)}</text>
        <text x="576" y="196" textAnchor="end" fill="var(--muted)" fontSize="12">{date(history[history.length - 1].date)}</text>
      </svg>
      <details className="mt-4 border-t border-[var(--admin-line)]"><summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold">{t.table}</summary>
        <table className="w-full text-left text-sm"><caption className="sr-only">{t.history}</caption><thead><tr>{[t.date, t.answers, t.correct].map(label => <th key={label} scope="col" className="py-2 text-xs font-semibold text-[var(--muted)]">{label}</th>)}</tr></thead>
          <tbody>{history.map(day => <tr key={day.date} className="border-t border-[var(--admin-line)]"><th scope="row" className="py-2 font-normal"><time dateTime={day.date}>{date(day.date)}</time></th><td className="tabular-nums">{day.answers}</td><td className="tabular-nums">{day.correct}</td></tr>)}</tbody>
        </table>
      </details>
    </>}
  </section>
}
