'use client'

import { useParams } from 'next/navigation'
import { getExamPrepUi } from '@/lib/exam-preparation/ui-copy'

export default function ExamError({ retry }: { retry: () => void }) {
  const { lang } = useParams<{ lang: string }>()
  const { t } = getExamPrepUi(lang)
  return <section lang={lang} className="space-y-4">
    <h1 className="text-2xl font-bold">{t('Dein Prüfungstrainer konnte nicht geladen werden')}</h1>
    <p>{t('Bitte versuche es erneut. Deine gespeicherten Antworten bleiben erhalten.')}</p>
    <button onClick={retry} className="st-button st-button--primary">{t('Erneut laden')}</button>
  </section>
}
