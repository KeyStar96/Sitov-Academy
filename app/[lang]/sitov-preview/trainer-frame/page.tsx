import { notFound } from 'next/navigation'
import SitovTrainerFramePreview from '@/components/dashboard/SitovTrainerFramePreview'
import { getDictionary } from '@/lib/dictionary'
import '@/components/dashboard/student.css'

export default async function SitovTrainerFramePreviewPage({ params }: { params: Promise<{ lang: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { lang } = await params
  const dict = await getDictionary(lang)
  const sitovSupportLabels = { whatsapp: dict.academy.support_whatsapp, phone: dict.Footer.Contact.phone,
    phoneLabel: dict.Footer.Contact.phone_label, telegram: dict.Footer.Contact.telegram_button,
    email: dict.Footer.Contact.email, emailLabel: dict.Footer.Contact.email_button }
  return <SitovTrainerFramePreview lang={lang} copy={dict.accessibility} translations={dict.dashboard} supportLabels={sitovSupportLabels} />
}
