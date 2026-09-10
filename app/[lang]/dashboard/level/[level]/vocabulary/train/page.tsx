import { getVocabularySession } from '@/app/actions/vocabulary'
import { getDictionary } from '@/lib/dictionary'
import VocabCardSession from '@/components/vocabulary/VocabCardSession'

export default async function VocabularyTrainPage({ params, searchParams }: {
  params: Promise<{ lang: string; level: string }>
  searchParams: Promise<{ lesson?: string }>
}) {
  const { lang, level } = await params
  const { lesson } = await searchParams
  const [session, dict] = await Promise.all([getVocabularySession(level, lang), getDictionary(lang)])
  return <VocabCardSession key={session.learnerId} learnerId={session.learnerId} cards={lesson ? session.cards.filter(item => item.card.lesson === lesson) : session.cards} initialDeferredCount={session.deferredCount} previousCardId={session.previousCardId}
    translations={dict.vocabulary ?? {}} uiLanguage={lang} overviewHref={`/${lang}/dashboard/level/${encodeURIComponent(level)}/vocabulary`} />
}
