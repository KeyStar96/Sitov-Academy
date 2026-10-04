'use client'

import { useParams } from 'next/navigation'
import { getExamPrepUi } from '@/lib/exam-preparation/ui-copy'

export default function ExamLoading() {
  const { lang } = useParams<{ lang: string }>()
  const { t } = getExamPrepUi(lang)
  return <div lang={lang} className="space-y-4" role="status" aria-label={t('Prüfungsvorbereitung wird geladen')}>
    <div className="h-36 rounded-3xl bg-[var(--surface-muted)] animate-pulse motion-reduce:animate-none" />
    <p className="text-[var(--muted)]">{t('Deine B1-Prüfungsvorbereitung wird geladen …')}</p>
  </div>
}
