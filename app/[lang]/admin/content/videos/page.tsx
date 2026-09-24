import { redirect } from 'next/navigation'

/** Videolinks werden jetzt in den Lernmedien gepflegt. Alte Lesezeichen führen dorthin. */
export default async function AdminVideosPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  redirect(`/${lang}/admin/content/media`)
}
