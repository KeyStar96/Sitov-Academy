import { getVocabs } from '@/app/actions/cms'
import VocabCMS from '@/components/admin/VocabCMS'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'

export default async function AdminVocabularyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [items, dictionary] = await Promise.all([getVocabs(), getDictionary(lang)])
  const t = createAdminTranslator(dictionary.admin)
  return <div className="min-w-0 space-y-5"><header><h1 className="text-2xl font-semibold text-[var(--foreground)]">{t('cms_title')}</h1><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{t('cms_intro')}</p></header><VocabCMS initialData={items} /></div>
}
