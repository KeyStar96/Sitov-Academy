import { notFound } from 'next/navigation'
import SitovTrainerMotionPreview from '@/components/motion/SitovTrainerMotionPreview'
import MotionProvider from '@/components/motion/MotionProvider'
import '@/components/dashboard/student.css'

/** Synthetic data for local visual QA; unavailable in production. */
export default async function SitovTrainerMotionPreviewPage({ params, searchParams }: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ view?: string }>
}) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { lang } = await params
  const { view } = await searchParams
  return <MotionProvider><SitovTrainerMotionPreview lang={lang} initialView={view === 'path' || view === 'pronunciation' ? view : 'vocabulary'} /></MotionProvider>
}
