import { getMediaFolders } from '@/app/actions/media'
import MediaFolderCMS from '@/components/admin/MediaFolderCMS'
import { mediaCopy } from '@/lib/media-i18n'

export default async function MediaPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const folders = await getMediaFolders()
  if (!folders.success) throw new Error('media_unavailable')
  const t = mediaCopy(lang)
  return <div className="space-y-6"><header><h1 className="text-3xl font-semibold">{t.title}</h1><p className="mt-3 text-[var(--muted)]">{t.intro}</p></header><MediaFolderCMS initial={folders.data} lang={lang} /></div>
}
