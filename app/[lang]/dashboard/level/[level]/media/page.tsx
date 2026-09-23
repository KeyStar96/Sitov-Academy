import { redirect } from 'next/navigation'

/** Unterlagen und Videos wohnen jetzt gemeinsam in der Mediathek. Alte Lesezeichen führen dorthin. */
export default async function MediaPage({ params }: { params: Promise<{ lang: string; level: string }> }) {
  const { lang, level } = await params
  redirect(`/${lang}/dashboard/level/${level}/videos`)
}
