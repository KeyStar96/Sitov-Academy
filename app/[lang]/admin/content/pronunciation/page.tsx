import { getAdminPronunciationPrompts } from '@/app/actions/pronunciation'
import { getDictionary } from '@/lib/dictionary'
import { getPronunciationTranslations } from '@/lib/pronunciation-i18n'
import PronunciationCMS from '@/components/admin/PronunciationCMS'
export default async function PronunciationContentPage({ params }: { params: Promise<{ lang: string }> }) {
 const { lang } = await params
 const [prompts, dictionary] = await Promise.all([getAdminPronunciationPrompts(), getDictionary(lang)])
 return <PronunciationCMS prompts={prompts} translations={getPronunciationTranslations(lang, dictionary.pronunciation)}/>
}
