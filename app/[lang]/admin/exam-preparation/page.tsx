import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getExamTeacherState } from '@/app/actions/exam-preparation'
import { getExamAudioProductionState } from '@/app/actions/exam-audio-production'
import ExamTeacherPanel from '@/components/exam-preparation/ExamTeacherPanel'
import ExamAudioProductionPanel from '@/components/exam-preparation/ExamAudioProductionPanel'
import { PageHeader, adminChip } from '@/components/admin/ui'
import { EXAM_AUDIO_ORDERS, EXAM_MODULES, EXAM_RECORDING_SESSIONS, EXAM_WORKSHOPS } from '@/lib/exam-preparation/content'
import { createClient } from '@/utils/supabase/server'
import styles from '@/components/exam-preparation/ExamTeacher.module.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'B1-Prüfungsvorbereitung · Lehrkraft · Sitov Academy' }

export default async function ExamPreparationTeacherPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ view?: string }> }) {
  const { lang } = await params
  const query = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'teacher') redirect(`/${lang}/dashboard`)
  const audioView = query.view === 'audio'
  return <div className={`${styles.shell} ${styles.stack}`}>
    <PageHeader eyebrow="Sitov Academy · B1-Pilot" title="B1-Prüfungsvorbereitung" description={audioView ? 'Eigene Hörtexte produzieren, Aufgaben gegen die Aufnahme prüfen und die geprüfte Fassung freigeben.' : 'Schreib- und Sprechprodukte besprechen, Überarbeitungen vergleichen und den Lernweg begründet freischalten.'} back={{ href: `/${lang}/admin/${audioView ? 'content' : 'submissions'}`, label: audioView ? 'Zu den Lerninhalten' : 'Zu den Abgaben' }} />
    <nav aria-label="Prüfungsvorbereitung verwalten" className={styles.tabs}>
      <Link href={`/${lang}/admin/exam-preparation`} className={adminChip(!audioView)} aria-current={!audioView ? 'page' : undefined}>B1-Abgaben</Link>
      <Link href={`/${lang}/admin/exam-preparation?view=audio`} className={adminChip(audioView)} aria-current={audioView ? 'page' : undefined}>Aufnahmeaufträge</Link>
    </nav>
    {audioView ? <ExamAudioProductionPanel orders={EXAM_AUDIO_ORDERS} sessions={EXAM_RECORDING_SESSIONS} state={await getExamAudioProductionState()} /> : <ExamTeacherPanel modules={EXAM_MODULES} workshops={EXAM_WORKSHOPS} state={await getExamTeacherState()} />}
  </div>
}
