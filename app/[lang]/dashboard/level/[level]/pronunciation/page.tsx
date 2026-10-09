import { getPronunciationConversations } from '@/app/actions/pronunciation-conversations'
import { getDictionary } from '@/lib/dictionary'
import { getPronunciationTranslations } from '@/lib/pronunciation-i18n'
import { getPronunciationPrompts } from '@/app/actions/pronunciation'
import PronunciationStudio from '@/components/audio/PronunciationStudio'
import { loadLearningNewItems } from '@/lib/learning-new-server'
import { loadLearningCheckpoint } from '@/app/actions/learning-checkpoints'
import { getSitovPronunciationPretests } from '@/app/actions/sitov-pronunciation-pretest'
import { requestSession } from '@/lib/request-session'

export default async function PronunciationDashboard({ params, searchParams }: {
  params: Promise<{ lang: string; level: string }>
  searchParams: Promise<{ tab?: string; conversation?: string; sitov_target?: string | string[] }>
}) {
  const { lang, level } = await params
  const { tab, conversation, sitov_target } = await searchParams
  const decodedLevel = decodeURIComponent(level)
  const { user } = await requestSession()
  const [dict, conversations, prompts, news, checkpoint, catalog] = await Promise.all([getDictionary(lang), getPronunciationConversations(decodedLevel), getPronunciationPrompts(decodedLevel), loadLearningNewItems(decodedLevel), loadLearningCheckpoint('pronunciation', decodedLevel), getSitovPronunciationPretests(decodedLevel).catch(() => ({ ok: false, error: 'retryable_failure', retryable: true } as const))])
  const translations = getPronunciationTranslations(lang, dict.pronunciation)
  // Der Link aus der Benachrichtigungs-Mail nennt das Gespräch; nur ein eigenes, vorhandenes wird geöffnet.
  const focus = conversation && conversations.some(entry => entry.id === conversation) ? conversation : undefined
  return <PronunciationStudio key={`${decodedLevel}:${user?.id ?? 'unauthenticated'}:${JSON.stringify(sitov_target) ?? 'none'}`} prompts={prompts} conversations={conversations} level={decodedLevel} lang={lang}
    translations={translations} initialTab={tab === 'mailbox' || focus ? 'mailbox' : 'studio'} newItems={news.items} focusConversation={focus}
    checkpoint={checkpoint.ok ? checkpoint.checkpoint : null} checkpointUnavailable={!checkpoint.ok} learnerId={user?.id} catalog={catalog} focusTextId={sitov_target} />
}
