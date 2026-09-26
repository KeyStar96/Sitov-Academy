import Link from 'next/link'
import type { ReactNode } from 'react'
import type { TeacherDetailData } from '@/lib/teacher-dashboard-contract'
import { teacherDistribution } from '@/lib/teacher-dashboard-contract'
import { teacherDashboardT } from '@/lib/teacher-dashboard-i18n'
import type { VocabularyTranslations } from '@/lib/vocabulary-i18n'
import PhaseDistributionChart from '@/components/vocabulary/PhaseDistributionChart'
import { BlackboardProvider } from './BlackboardProvider'
import BlackboardEditor from './BlackboardEditor'
import { displayDate, studyTime, dashboardPanel as panel, dashboardButton as button } from './TeacherDashboardShared'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className={panel}><h2 className="mb-4 text-xl font-bold">{title}</h2>{children}</section>
}
export function TeacherStudentVocabulary({ data, lang, translations }: { data: TeacherDetailData['vocabulary']; lang: string; translations: VocabularyTranslations }) {
  const t = teacherDashboardT(lang)
  return <div className="space-y-5">
    <p className={panel}>{t('privateWords', { count: data.ownWordCount })}</p>
    <Section title={t('byLevel')}><div className="grid gap-5 lg:grid-cols-2">{data.byLevel.map(item => <div key={item.level} className="rounded-xl border border-[var(--border)] p-4"><h3 className="mb-4 text-lg font-bold">{item.level}</h3><PhaseDistributionChart distribution={teacherDistribution(item.phases, item.totalCards)} translations={translations} /></div>)}</div>{!data.byLevel.length && <p>{t('empty')}</p>}</Section>
    <Section title={t('byLesson')}><div className="space-y-3">{data.byLesson.map(item => <details key={item.id} className="rounded-xl border border-[var(--border)]"><summary className="min-h-12 cursor-pointer p-4 text-lg font-semibold">{item.level} · {item.title}</summary><div className="p-4"><PhaseDistributionChart distribution={teacherDistribution(item.phases, item.totalCards)} translations={translations} /></div></details>)}</div>{!data.byLesson.length && <p>{t('empty')}</p>}</Section>
    <div className="grid items-start gap-5 lg:grid-cols-2"><Section title={t('halfKnown')}>{data.halfKnown.length ? <ul className="space-y-3">{data.halfKnown.map(item => <li key={item.id} className="break-words"><strong>{item.word}</strong> · {item.level} · {item.boxes.map(phase => t('phase', { phase })).join(' / ')}</li>)}</ul> : <p>{t('empty')}</p>}</Section><Section title={t('hardest')}>{data.hardest.length ? <ol className="space-y-3">{data.hardest.map(item => <li key={item.id} className="break-words"><strong>{item.word}</strong> · {item.level} · {item.regressions}</li>)}</ol> : <p>{t('empty')}</p>}</Section></div>
    <Section title={t('recentAnswers')}>{data.recentAnswers.length ? <ol className="space-y-3">{data.recentAnswers.map(item => <li key={item.id} className="break-words rounded-xl bg-[var(--surface-muted)] p-4"><p className="text-lg font-semibold">{item.word} · {item.level}</p><p className="mt-1">{t('answer')}: {item.typedAnswer ?? '—'}</p><p>{t(item.correct ? 'correct' : 'incorrect')} · {displayDate(item.createdAt, lang)}</p></li>)}</ol> : <p>{t('empty')}</p>}</Section>
    <div className="grid gap-5 lg:grid-cols-2"><Section title={t('paused')}>{data.pausedLessons.length ? <ul className="space-y-3">{data.pausedLessons.map(item => <li key={item.id}>{item.level} · {item.title}</li>)}</ul> : <p>{t('empty')}</p>}</Section><Section title={t('carryover')}>{data.carryover.length ? <ul className="space-y-3">{data.carryover.map(item => <li key={item.level}><strong>{item.level}</strong> · {t(item.enabled ? 'enabled' : 'disabled')} · {item.count}</li>)}</ul> : <p>{t('empty')}</p>}</Section></div>
  </div>
}
export function TeacherStudentPronunciation({ data, lang }: { data: TeacherDetailData['pronunciation']; lang: string }) {
  const t = teacherDashboardT(lang)
  return <div className="space-y-5"><dl className={`${panel} grid gap-4 sm:grid-cols-2`}><div><dt>{t('openRecordings')}</dt><dd className="text-2xl font-bold">{data.conversations.filter(item => item.status === 'pending').length}</dd></div><div><dt>{t('unanswered')}</dt><dd className="text-2xl font-bold">{data.conversations.reduce((sum, item) => sum + item.unansweredCount, 0)}</dd></div></dl><Section title={t('pronunciation')}>{!data.conversations.length ? <p>{t('empty')}</p> : <ul className="space-y-4">{data.conversations.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-4"><div><p className="font-bold">{displayDate(item.lastMessageAt ?? item.createdAt, lang)}</p><p>{t('messages')}: {item.messageCount} · {t('unanswered')}: {item.unansweredCount}</p><p>{t(item.status === 'pending' ? 'in_progress' : 'completed')}</p></div><Link className={button} href={`/${lang}/admin/submissions?conversation=${item.id}`}>{t('openConversation')}</Link></li>)}</ul>}</Section></div>
}
export function TeacherStudentActivity({ data, lang }: { data: TeacherDetailData['activity']; lang: string }) {
  const t = teacherDashboardT(lang)
  const maximum = Math.max(1, ...data.days.map(day => day.seconds))
  return <div className="space-y-5"><p className={panel}>{t('timeHint')}</p><Section title={t('calendar')}><ul className="grid grid-cols-5 gap-2 sm:grid-cols-7">{data.days.map(day => <li key={day.date} className="min-w-0 rounded-lg border border-[var(--border)] p-2 text-center" style={{ background: day.active ? `color-mix(in srgb, var(--success) ${Math.round(10 + day.seconds / maximum * 20)}%, var(--surface))` : 'var(--surface-muted)' }}><time dateTime={day.date} className="block text-base font-semibold">{new Date(`${day.date}T12:00:00Z`).toLocaleDateString(lang, { day: 'numeric', month: 'short' })}</time><span className="mt-1 block text-base">{studyTime(day.seconds, lang)}</span><span className="sr-only">{t('answers')}: {day.answers}</span></li>)}</ul></Section>
    <Section title={t('modes')}><dl className="grid gap-4 sm:grid-cols-3">{data.byMode.map(item => <div key={item.mode}><dt>{t(item.mode === 'exercises' || item.mode === 'exercise' || item.mode === 'path' ? 'path' : item.mode === 'pronunciation' ? 'pronunciation' : item.mode === 'videos' || item.mode === 'media' ? 'media' : 'vocabulary')}</dt><dd className="text-2xl font-semibold">{studyTime(item.seconds, lang)}</dd></div>)}</dl>{!data.byMode.length && <p>{t('empty')}</p>}</Section>
    <Section title={t('history')}><table className="w-full table-fixed text-left"><thead><tr><th scope="col" className="pb-3">{t('date')}</th><th scope="col" className="pb-3">{t('time30')}</th><th scope="col" className="pb-3">{t('answers')}</th></tr></thead><tbody>{data.days.map(day => <tr key={day.date} className="border-t border-[var(--border)]"><th scope="row" className="py-3 font-normal">{new Date(`${day.date}T12:00:00Z`).toLocaleDateString(lang)}</th><td className="py-3"><span className="block">{studyTime(day.seconds, lang)}</span><span aria-hidden="true" className="mt-2 block h-2 rounded-full bg-[var(--success)]" style={{ width: `${day.seconds / maximum * 100}%` }} /></td><td className="py-3">{day.answers}</td></tr>)}</tbody></table></Section>
  </div>
}
export function TeacherStudentNotes({ data, studentId, studentName, lang }: { data: TeacherDetailData['notes']; studentId: string; studentName: string; lang: string }) {
  const t = teacherDashboardT(lang)
  const latest = data.notes[0]
  return <Section title={t('notes')}><div className="space-y-5"><BlackboardProvider initialNotes={latest ? { [studentId]: { ...latest, student_id: studentId } } : {}}><BlackboardEditor studentId={studentId} studentName={studentName} /></BlackboardProvider>{data.notes.length ? <ol className="space-y-4">{data.notes.map(note => <li key={note.id} className="rounded-xl border border-[var(--border)] p-4"><p className="whitespace-pre-wrap break-words text-base">{note.note_text}</p><p className="mt-3 text-base text-[var(--muted)]">{displayDate(note.updated_at, lang)}</p></li>)}</ol> : <p>{t('empty')}</p>}</div></Section>
}
