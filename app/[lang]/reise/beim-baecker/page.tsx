import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BakeryJourney from '@/components/journey/BakeryJourney'

export const metadata: Metadata = {
  title: 'Beim Bäcker – Deine Deutschreise',
  description: 'Eine kleine Deutschreise von Sitov Academy: Wörter entdecken, höflich bestellen und ins Gespräch kommen.',
  robots: { index: false, follow: false },
}

export default async function BakeryJourneyPage({ params }: {
  params: Promise<{ lang: string }>
}) {
  // This design pilot must remain unavailable in every production deployment.
  if (process.env.NODE_ENV !== 'development') notFound()
  const { lang } = await params
  if (lang !== 'de') notFound()
  return <BakeryJourney homeHref={`/${lang}`} />
}
