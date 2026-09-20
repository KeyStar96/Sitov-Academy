import { getVideos } from '@/app/actions/cms'
import VideoCMS from '@/components/admin/VideoCMS'
import { getDictionary } from '@/lib/dictionary'
import { createVideoTranslator } from '@/lib/videos-i18n'

export default async function AdminVideosPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [items, dict] = await Promise.all([getVideos(), getDictionary(lang)])
  const t = createVideoTranslator(dict.videos ?? {})
  return <div className="space-y-8 text-[var(--foreground)]">
    <header><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('cms_title')}</h1><p className="mt-3 max-w-2xl leading-relaxed text-[var(--muted)]">{t('cms_subtitle')}</p></header>
    <VideoCMS lang={lang} initialData={items} translations={dict.videos ?? {}} />
  </div>
}
