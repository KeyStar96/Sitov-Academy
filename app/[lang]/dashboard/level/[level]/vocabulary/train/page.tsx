import TrainerLanguageRequired from '@/components/dashboard/TrainerLanguageRequired'
import { getVocabularySession, getVocabularyCarryover } from '@/app/actions/vocabulary'
import { getDictionary } from '@/lib/dictionary'
import VocabularyTrainingStart from '@/components/vocabulary/VocabularyTrainingStart'

export default async function VocabularyTrainPage({ params, searchParams }: {
  params: Promise<{ lang: string; level: string }>
  searchParams: Promise<{ lesson?: string }>
}) {
  const { lang, level } = await params
  if (lang === 'de') return <TrainerLanguageRequired lang={lang} />
  const { lesson } = await searchParams
  const decodedLevel = decodeURIComponent(level)
  const [session, dict] = await Promise.all([getVocabularySession(decodedLevel, lang), getDictionary(lang)])
  const carryover = session.cards.length === 0 && session.learnerId ? await getVocabularyCarryover(decodedLevel) : null
  const emptyWithoutCandidates = session.cards.length === 0 && (!session.learnerId || carryover?.total === 0)
  return <VocabularyTrainingStart key={session.learnerId} learnerId={session.learnerId} level={decodedLevel} lesson={lesson} cards={session.cards} initialDeferredCount={session.deferredCount} previousCardId={session.previousCardId}
    emptyWithoutCandidates={emptyWithoutCandidates}
    translations={dict.vocabulary ?? {}} softErrorTranslations={dict.exercises?.soft_error} uiLanguage={lang} overviewHref={`/${lang}/dashboard/level/${encodeURIComponent(decodedLevel)}/vocabulary`} />
}
