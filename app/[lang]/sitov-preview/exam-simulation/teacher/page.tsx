import Link from 'next/link'
import { notFound } from 'next/navigation'
import ExamSimulationTeacher from '@/components/exam-simulation/ExamSimulationTeacher'
import TeacherLayout from '@/components/admin/TeacherLayout'
import { AdminI18nProvider } from '@/components/admin/AdminI18nProvider'
import BrandLogo from '@/components/layout/BrandLogo'
import { getDictionary } from '@/lib/dictionary'
import type { SimulationTeacherState } from '@/lib/exam-simulation/server'
import type { SimulationTask } from '@/lib/exam-simulation/types'

export default async function SimulationTeacherPreview({ params }: { params: Promise<{ lang: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { lang } = await params
  const dictionary = await getDictionary('de')
  const reading: SimulationTask = { id: 'sitov-preview-reading', version: 1, level: 'B1', skill: 'reading', family: 'reading-rules', type: 'true-false', title: 'Die Öffnungszeit verstehen', instruction: 'Lesen Sie die Mitteilung. Ist die Aussage richtig oder falsch?', text: 'Die Bibliothek öffnet am Samstag um neun Uhr.', options: [{ id: 'true', text: 'Richtig' }, { id: 'false', text: 'Falsch' }], maxPoints: 20, minutes: 5 }
  const writing: SimulationTask = { id: 'sitov-preview-writing', version: 1, level: 'B1', skill: 'writing', family: 'writing-message', type: 'writing', title: 'Eine Nachricht schreiben', instruction: 'Schreiben Sie Ihrem Freund Leon eine Nachricht und schlagen Sie einen neuen Termin vor.', criteria: ['Anlass verständlich erklären', 'Einen passenden neuen Termin vorschlagen'], maxPoints: 20, minutes: 15 }
  const initial: SimulationTeacherState = {
    success: true, actorRole: 'teacher', students: [{ id: 'sitov-preview-max', name: 'Max' }, { id: 'sitov-preview-daniel', name: 'Daniel' }], unassignedStudents: [{ id: 'sitov-preview-leon', name: 'Leon' }, { id: 'sitov-preview-paul', name: 'Paul' }], teachers: [], assignments: [], featureGrants: [], levelGrants: [],
    runs: [{ studentId: 'sitov-preview-max', studentName: 'Max', session: {
      id: 'sitov-preview-run', version: 1, profileId: 'sitov_b1', level: 'B1', provider: 'sitov', mode: 'exam', title: 'Simulierte Prüfung B1', startedAt: '2026-10-04T10:00:00Z', expiresAt: '2026-10-04T12:30:00Z', completedAt: '2026-10-04T11:25:00Z', status: 'completed', tasks: [reading, writing], answers: { [reading.id]: 'true', [writing.id]: 'Hallo Leon, ich kann am Freitag leider nicht kommen. Können wir uns am Samstag um zehn Uhr treffen? Viele Grüße, Max' }, coverage: { included: [reading.family, writing.family], missing: [], fullExam: false, note: 'Fiktives Beispiel für die Lehrkraft-Oberfläche.' },
      result: { status: 'teacher-review-required', headline: 'Die fachliche Bewertung steht noch aus', description: 'Die Leseantwort ist richtig. Der Schreibtext wartet auf die Lehrkraft.', examPass: null, percentage: null, reviewedPoints: 20, reviewedMaxPoints: 20, totalMaxPoints: 40, pendingTeacherTasks: 1, missingSkills: [], nextSteps: ['Schreib-Rückmeldung abwarten'], skills: [{ skill: 'reading', title: 'Lesen', points: 20, maxPoints: 20, percentage: 100, pendingTeacherTasks: 0, correctTasks: 1, wrongTasks: 0 }, { skill: 'writing', title: 'Schreiben', points: 0, maxPoints: 20, percentage: null, pendingTeacherTasks: 1, correctTasks: 0, wrongTasks: 0 }], feedback: [{ taskId: reading.id, title: reading.title, skill: 'reading', family: reading.family, answer: 'true', answerText: 'Richtig', correct: true, points: 20, maxPoints: 20, expectedAnswer: 'Richtig', explanation: 'Die Mitteilung nennt Samstag um neun Uhr.', evidence: 'Die Bibliothek öffnet am Samstag um neun Uhr.' }, { taskId: writing.id, title: writing.title, skill: 'writing', family: writing.family, answer: 'Hallo Leon, ich kann am Freitag leider nicht kommen. Können wir uns am Samstag um zehn Uhr treffen? Viele Grüße, Max', correct: null, points: null, maxPoints: 20, explanation: 'Die Lehrkraft prüft den Text fachlich.', criteria: writing.criteria }] },
    } }],
  }
  const brand = <Link href={`/${lang}/sitov-preview/exam-simulation/teacher`}><BrandLogo name="Sitov Academy" /></Link>
  return <AdminI18nProvider translations={dictionary.admin}><TeacherLayout lang={lang} brand={brand} controls={<span className="text-sm text-[var(--muted)]">Vorschau</span>} account={{ name: 'Jonas', role: 'Lehrkraft · Vorschau' }} sitovPreviewPathname={`/${lang}/admin/exam-simulation`}><ExamSimulationTeacher initial={initial} lang={lang} preview /></TeacherLayout></AdminI18nProvider>
}
