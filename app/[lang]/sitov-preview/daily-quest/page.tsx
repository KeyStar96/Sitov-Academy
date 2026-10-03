import { notFound } from 'next/navigation'
import DailyQuestEntry from '@/components/dashboard/DailyQuestEntry'
import type { DailyQuestStatus } from '@/lib/daily-quest-contract'
import '@/components/dashboard/student.css'

const id = 'c9e3e3ca-69ac-4383-90cd-3788dc1e3104'
const state = (current: number, longest: number, status: 'active' | 'completed', enabled = true): DailyQuestStatus =>
  ({ success: true, enabled, streak: { current, longest, lastCompletedDate: null }, today: { assignmentId: id, status } })
const STATES = [state(0, 0, 'active'), state(3, 5, 'active'), state(12, 12, 'completed'), state(128, 128, 'active'), state(2, 9, 'active', false)]

/** Nur in der Entwicklung: alle Zustände der Deutschreise-Karte nebeneinander. */
export default async function DailyQuestPreviewPage({ params }: { params: Promise<{ lang: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { lang } = await params
  return <div className="academy-container" style={{ display: 'grid', gap: '1.25rem', maxWidth: 720, paddingBlock: '2rem' }}>
    {STATES.map((status, index) => <DailyQuestEntry key={index} lang={lang} status={status} />)}
  </div>
}
