import { notFound } from 'next/navigation'
import SitovTrainerFramePreview from '@/components/dashboard/SitovTrainerFramePreview'
import { getDictionary } from '@/lib/dictionary'
import '@/components/dashboard/student.css'

export default async function SitovTrainerFramePreviewPage({ params }: { params: Promise<{ lang: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { lang } = await params
  const dict = await getDictionary(lang)
  return <SitovTrainerFramePreview lang={lang} copy={dict.accessibility} />
}
