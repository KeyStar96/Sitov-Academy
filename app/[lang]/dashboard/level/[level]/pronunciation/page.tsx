import TrainerLanguageRequired from '@/components/dashboard/TrainerLanguageRequired'
import { getPronunciationConversations } from '@/app/actions/pronunciation-conversations'
import { getDictionary } from '@/lib/dictionary'
import { getPronunciationTranslations } from '@/lib/pronunciation-i18n'
import { getPronunciationPrompts } from '@/app/actions/pronunciation'
import PronunciationStudio from '@/components/audio/PronunciationStudio'

export default async function PronunciationDashboard({ params, searchParams }: {
  params: Promise<{ lang: string; level: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { lang, level } = await params
  if (lang === 'de') return <TrainerLanguageRequired lang={lang} />
  const { tab } = await searchParams
  const decodedLevel = decodeURIComponent(level)
  const dict = await getDictionary(lang)
  const translations = getPronunciationTranslations(lang, dict.pronunciation)
  const [conversations, prompts] = await Promise.all([getPronunciationConversations(decodedLevel), getPronunciationPrompts(decodedLevel)])
  return <PronunciationStudio prompts={prompts} conversations={conversations} level={decodedLevel} lang={lang}
    translations={translations} initialTab={tab === 'mailbox' ? 'mailbox' : 'studio'} />
}
