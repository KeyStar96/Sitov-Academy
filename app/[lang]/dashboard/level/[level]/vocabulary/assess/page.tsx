import Link from 'next/link'
import { ListChecks } from 'lucide-react'
import { getLessonCards } from '@/app/actions/vocabulary'
import { getDictionary } from '@/lib/dictionary'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import LessonAssessmentClient from './LessonAssessmentClient'

export default async function VocabularyAssessPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; level: string }>
  searchParams: Promise<{ lesson?: string }>
}) {
  const { lang, level } = await params
  const { lesson } = await searchParams
  const decodedLevel = decodeURIComponent(level)
  const decodedLesson = lesson ? decodeURIComponent(lesson) : ''
  const dict = await getDictionary(lang)
  const translations = (dict.vocabulary ?? {}) as VocabularyTranslations
  const t = createVocabularyTranslator(translations)
  const overviewHref = `/${lang}/dashboard/level/${encodeURIComponent(decodedLevel)}/vocabulary`

  const allCards = decodedLesson ? await getLessonCards(decodedLesson, decodedLevel) : []
  const cardsToAssess = allCards.filter((card) => card.phase === null)

  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl rounded-3xl bg-white p-5 py-8 shadow-sm ring-1 ring-gray-900/5 sm:p-8">

      <div className="mb-6 border-b border-gray-200 pb-6">
        <h1 className="flex items-center gap-3 break-words text-3xl font-extrabold text-gray-900 sm:text-4xl">
          <ListChecks className="h-8 w-8 shrink-0 text-blue-600" aria-hidden="true" />
          {t('assess_title')}
        </h1>
        <p className="mt-2 text-xl text-gray-600">{t('assess_subtitle')}</p>
      </div>

      {cardsToAssess.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 py-12 text-center">
          <p className="text-xl font-bold text-gray-800">{t('assess_empty_title')}</p>
          <p className="mx-auto mt-2 max-w-md text-lg text-gray-600">{t('assess_empty_text')}</p>
          <Link
            href={overviewHref}
            className="mt-8 inline-flex min-h-16 items-center justify-center rounded-2xl bg-blue-600 px-8 py-4 text-xl font-bold text-white shadow-md transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
          >
            {t('back_to_overview')}
          </Link>
        </div>
      ) : (
        <LessonAssessmentClient
          cards={cardsToAssess}
          lessonName={decodedLesson}
          lang={lang}
          level={decodedLevel}
          translations={translations}
        />
      )}
    </div>
  )
}
