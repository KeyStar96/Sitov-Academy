import TrainerLanguageRequired from '@/components/dashboard/TrainerLanguageRequired'
import { getPronunciationConversations } from '@/app/actions/pronunciation-conversations'
import { getDictionary } from '@/lib/dictionary'
import { getPronunciationTranslations } from '@/lib/pronunciation-i18n'
import { getPronunciationPrompts } from '@/app/actions/pronunciation'
import PronunciationStudio from '@/components/audio/PronunciationStudio'
import { loadLearningNewItems } from '@/lib/learning-new-server'

export default async function PronunciationDashboard({ params, searchParams }: {
  params: Promise<{ lang: string; level: string }>
  searchParams: Promise<{ tab?: string; conversation?: string }>
}) {
  const { lang, level } = await params
  if (lang === 'de') return <TrainerLanguageRequired lang={lang} />
  const { tab, conversation } = await searchParams
  const decodedLevel = decodeURIComponent(level)
  const dict = await getDictionary(lang)
  const translations = getPronunciationTranslations(lang, dict.pronunciation)
  const [conversations, prompts, news] = await Promise.all([getPronunciationConversations(decodedLevel), getPronunciationPrompts(decodedLevel), loadLearningNewItems(decodedLevel)])
  // Der Link aus der Benachrichtigungs-Mail nennt das Gespräch; nur ein eigenes, vorhandenes wird geöffnet.
  const focus = conversation && conversations.some(entry => entry.id === conversation) ? conversation : undefined
  return <PronunciationStudio prompts={prompts} conversations={conversations} level={decodedLevel} lang={lang}
    translations={translations} initialTab={tab === 'mailbox' || focus ? 'mailbox' : 'studio'} newItems={news.items} focusConversation={focus} />
}
