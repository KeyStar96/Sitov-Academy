import { getAdminPronunciationPrompts } from '@/app/actions/pronunciation'
import { getDictionary } from '@/lib/dictionary'
import { getPronunciationTranslations } from '@/lib/pronunciation-i18n'
import PronunciationCMS from '@/components/admin/PronunciationCMS'
import SitovPronunciationPretestStaff from '@/components/admin/SitovPronunciationPretestStaff'
import { requestSession } from '@/lib/request-session'
import { createHash } from 'node:crypto'
import { SITOV_PLATFORM_LEVELS } from '@/lib/access/levels'
export default async function PronunciationContentPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ level?: string | string[] }> }) {
 const [{ lang }, { level }] = await Promise.all([params, searchParams])
 const [prompts, dictionary, session] = await Promise.all([getAdminPronunciationPrompts(), getDictionary(lang), requestSession()])
 const targets = prompts.filter(prompt => prompt.level).map(prompt => ({ textId: prompt.id, level: prompt.level!, title: prompt.title ?? prompt.lesson, textVersion: createHash('sha256').update(prompt.sentenceDe, 'utf8').digest('hex') }))
 return <div className="space-y-6"><PronunciationCMS prompts={prompts} translations={getPronunciationTranslations(lang, dictionary.pronunciation)} lang={lang} initialLevel={typeof level === 'string' ? level : undefined}/>
  <SitovPronunciationPretestStaff targets={targets} levels={[...SITOV_PLATFORM_LEVELS, ...targets.map(target => target.level)]} lang={lang} accountId={session.user?.id ?? 'unauthenticated'} initialLevel={typeof level === 'string' ? level : undefined}/></div>
}
