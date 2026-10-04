import type { ReactNode } from 'react'
import SitovLearningShell from '@/components/layout/SitovLearningShell'
import { getDictionary } from '@/lib/dictionary'

/** Development-only callers supply safe fixtures; this creates no learner session. */
export default async function ExamPreviewShell({ lang, area, children }: {
  lang: string; area: 'exam-preparation' | 'exam-simulation'; children: ReactNode
}) {
  const sitovDictionary = await getDictionary(lang)
  const sitovSupport = {
    whatsapp: sitovDictionary.academy.support_whatsapp,
    phone: sitovDictionary.Footer.Contact.phone,
    phoneLabel: sitovDictionary.Footer.Contact.phone_label,
    telegram: sitovDictionary.Footer.Contact.telegram_button,
    email: sitovDictionary.Footer.Contact.email,
    emailLabel: sitovDictionary.Footer.Contact.email_button,
  }
  return <SitovLearningShell lang={lang} translations={sitovDictionary.dashboard}
    displayName="Dennis" levels={['A1.1', 'A2.1', 'B1.1']} lastActiveLevel="B1.1"
    supportLabels={sitovSupport} sitovPreviewPathname={`/${lang}/dashboard/${area}`}>
    {children}
  </SitovLearningShell>
}
