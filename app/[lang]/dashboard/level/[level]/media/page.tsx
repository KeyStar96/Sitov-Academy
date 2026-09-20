import Link from 'next/link'
import { getMediaFolders } from '@/app/actions/media'
import MediaFolders from '@/components/dashboard/MediaFolders'
import { mediaCopy } from '@/lib/media-i18n'

export default async function MediaPage({ params }: { params: Promise<{ lang: string; level: string }> }) {
  const { lang, level } = await params
  const result = await getMediaFolders(decodeURIComponent(level))
  if (!result.success) throw new Error('media_unavailable')
  const t = mediaCopy(lang)
  return <div className="space-y-6"><Link href={`/${lang}/dashboard/level/${level}`} className="inline-flex min-h-12 items-center underline">{t.back}</Link><h1 className="text-3xl font-semibold">{t.title}</h1><MediaFolders folders={result.data} lang={lang} /></div>
}
