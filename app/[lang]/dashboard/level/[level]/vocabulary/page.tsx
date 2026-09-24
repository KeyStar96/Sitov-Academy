import TrainerLanguageRequired from '@/components/dashboard/TrainerLanguageRequired'
import { getVocabularySession, getVocabularyOverview } from '@/app/actions/vocabulary'
import { getDictionary } from '@/lib/dictionary'
import { type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import VocabTrainerPageClient from '@/components/vocabulary/VocabTrainerPageClient'

export default async function VocabularyOverviewPage({
  params,
}: {
  params: Promise<{ lang: string; level: string }>
}) {
  const { lang, level } = await params
  if (lang === 'de') return <TrainerLanguageRequired lang={lang} />
  const decodedLevel = decodeURIComponent(level)
  const dict = await getDictionary(lang)
  const translations = (dict.vocabulary ?? {}) as VocabularyTranslations

  const [overview, session] = await Promise.all([
    getVocabularyOverview(decodedLevel),
    getVocabularySession(decodedLevel, lang),
  ])

  return (
    <VocabTrainerPageClient
      key={session.learnerId}
      learnerId={session.learnerId}
      initialCards={session.cards}
      initialDeferredCount={session.deferredCount}
      initialPreviousCardId={session.previousCardId}
      boxSummary={overview.box}
      translations={translations}
      softErrorTranslations={dict.exercises?.soft_error}
      lang={lang}
      level={decodedLevel}
    />
  )
}
