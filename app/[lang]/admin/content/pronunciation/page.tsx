import { getAdminPronunciationPrompts } from '@/app/actions/pronunciation'
import { getDictionary } from '@/lib/dictionary'
import { getPronunciationTranslations } from '@/lib/pronunciation-i18n'
import PronunciationCMS from '@/components/admin/PronunciationCMS'
export default async function PronunciationContentPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ level?: string | string[] }> }) {
 const [{ lang }, { level }] = await Promise.all([params, searchParams])
 const [prompts, dictionary] = await Promise.all([getAdminPronunciationPrompts(), getDictionary(lang)])
 return <PronunciationCMS prompts={prompts} translations={getPronunciationTranslations(lang, dictionary.pronunciation)} lang={lang} initialLevel={typeof level === 'string' ? level : undefined}/>
}
