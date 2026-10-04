import TrainerLanguageRequired from '@/components/dashboard/TrainerLanguageRequired'
import { getPronunciationConversations } from '@/app/actions/pronunciation-conversations'
import { getDictionary } from '@/lib/dictionary'
import { getPronunciationTranslations } from '@/lib/pronunciation-i18n'
import { getPronunciationPrompts } from '@/app/actions/pronunciation'
import PronunciationStudio from '@/components/audio/PronunciationStudio'
import { loadLearningNewItems } from '@/lib/learning-new-server'
import { loadLearningCheckpoint } from '@/app/actions/learning-checkpoints'
import { getSitovPronunciationReadiness } from '@/app/actions/sitov-pronunciation-access'

export default async function PronunciationDashboard({ params, searchParams }: {
  params: Promise<{ lang: string; level: string }>
  searchParams: Promise<{ tab?: string; conversation?: string }>
}) {
  const { lang, level } = await params
  if (lang === 'de') return <TrainerLanguageRequired lang={lang} />
  const { tab, conversation } = await searchParams
  const decodedLevel = decodeURIComponent(level)
  const [dict, conversations, prompts, news, checkpoint, readiness] = await Promise.all([getDictionary(lang), getPronunciationConversations(decodedLevel), getPronunciationPrompts(decodedLevel), loadLearningNewItems(decodedLevel), loadLearningCheckpoint('pronunciation', decodedLevel), getSitovPronunciationReadiness(decodedLevel)])
  const translations = getPronunciationTranslations(lang, dict.pronunciation)
  // Der Link aus der Benachrichtigungs-Mail nennt das Gespräch; nur ein eigenes, vorhandenes wird geöffnet.
  const focus = conversation && conversations.some(entry => entry.id === conversation) ? conversation : undefined
  return <PronunciationStudio key={`${decodedLevel}:${checkpoint.ok ? checkpoint.learnerId : 'unavailable'}`} prompts={prompts} conversations={conversations} level={decodedLevel} lang={lang}
    translations={translations} initialTab={tab === 'mailbox' || focus ? 'mailbox' : 'studio'} newItems={news.items} focusConversation={focus}
    checkpoint={checkpoint.ok ? checkpoint.checkpoint : null} checkpointUnavailable={!checkpoint.ok} learnerId={checkpoint.ok ? checkpoint.learnerId : undefined} readiness={readiness} />
}
