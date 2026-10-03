import { notFound } from 'next/navigation'
import VerbTrainerPreview from '@/components/verbs/VerbTrainerPreview'
import '@/components/dashboard/student.css'

export default async function SitovVerbPreviewPage({ params }: { params: Promise<{ lang: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { lang } = await params
  return <VerbTrainerPreview lang={lang} />
}
