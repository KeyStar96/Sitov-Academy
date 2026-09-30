import { getVocabs } from '@/app/actions/cms'
import VocabCMS from '@/components/admin/VocabCMS'
import { PageHeader } from '@/components/admin/ui'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'
import { contentAdminCopy } from '@/lib/content-admin-i18n'

export default async function AdminVocabularyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [items, dictionary] = await Promise.all([getVocabs(), getDictionary(lang)])
  const t = createAdminTranslator(dictionary.admin)
  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <PageHeader eyebrow={t('group_content')} title={t('nav_vocabulary')} description={contentAdminCopy(lang).vocabularyIntro} />
      <VocabCMS initialData={items} />
    </div>
  )
}
