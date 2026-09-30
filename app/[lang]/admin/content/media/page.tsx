import { getLooseMediaLinks, getMediaFolders } from '@/app/actions/media'
import MediaFolderCMS from '@/components/admin/MediaFolderCMS'
import { PageHeader } from '@/components/admin/ui'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'
import { contentAdminCopy } from '@/lib/content-admin-i18n'

export default async function MediaPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [folders, looseLinks, dictionary] = await Promise.all([getMediaFolders(), getLooseMediaLinks(), getDictionary(lang)])
  if (!folders.success) throw new Error('media_unavailable')
  const t = createAdminTranslator(dictionary.admin)
  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <PageHeader eyebrow={t('group_content')} title={t('nav_media')} description={contentAdminCopy(lang).mediaIntro} />
      <MediaFolderCMS initial={folders.data} initialLooseLinks={looseLinks.success ? looseLinks.data : []} lang={lang} />
    </div>
  )
}
