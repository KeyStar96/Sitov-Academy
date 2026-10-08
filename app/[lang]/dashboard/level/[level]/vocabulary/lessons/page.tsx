import { resolveSitovVocabularyTarget } from '@/lib/learning/sitov-learning-target-server'
import TrainerLanguageRequired from '@/components/dashboard/TrainerLanguageRequired'
import { sitovLearningSourceLocale } from '@/lib/access/sitov-learning-source'
import { requestSession } from '@/lib/request-session'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { getDictionary } from '@/lib/dictionary'
import { loadLevelLearningStatus } from '@/lib/learning-status-server'
import { loadLearningNewItems } from '@/lib/learning-new-server'
import { toStations } from '@/lib/lesson-stations'
import { modeHref } from '@/lib/mode-targets'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { lessonLabel, OWN_WORDS_LESSON } from '@/lib/vocabulary-own-words'
import VocabularyLessons, { type LessonsNext } from '@/components/vocabulary/VocabularyLessons'

/**
 * „Lektionen" im Modus Vokabeln: jede Lektion als Station mit ihrem
 * Lernbox-Schalter, darunter „Eigene Wörter". Der Weiter-Knopf führt zu
 * fälligen Karten in der Lernbox oder beginnt die nächste Lektion.
 * Die Sperre (Oberflächensprache, Trainer-Freigabe) prüft das Layout.
 */
export default async function VocabularyLessonsPage({ params, searchParams }: {
  params: Promise<{ lang: string; level: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { lang, level } = await params
  const query = await searchParams
  const sitovInitialWord = typeof query.sitovWord === 'string' && query.sitovWord.trim().length <= 160 ? query.sitovWord.trim() : ''
  const sitovInitialExample = typeof query.sitovExample === 'string' && query.sitovExample.trim().length <= 1000 ? query.sitovExample.trim() : ''
  const decodedLevel = decodeURIComponent(level)
  const { supabase, user } = await requestSession()
  const [profile, dict] = await Promise.all([
    user ? loadLevelAccessProfile(supabase, user.id) : null,
    getDictionary(lang),
  ])
  if (profile && !sitovLearningSourceLocale(lang, profile.native_language)) return <TrainerLanguageRequired lang={lang} />
  const [status, news, sitovTarget] = await Promise.all([
    user ? loadLevelLearningStatus({ supabase, userId: user.id, profile, level: decodedLevel, lang }) : null,
    loadLearningNewItems(decodedLevel),
    resolveSitovVocabularyTarget(query.sitov_target, decodedLevel, { supabase, user }, profile),
  ])
  const s = studentTranslator(lang)
  const translations = (dict.vocabulary ?? {}) as VocabularyTranslations
  const vocabularyT = createVocabularyTranslator(translations)
  const stations = toStations(status?.lessons ?? [], lesson => lessonLabel(lesson, vocabularyT))
  const vocabulary = status?.vocabulary
  const open = !!vocabulary && !vocabulary.locked
  const current = stations.find(station => station.state === 'current')
  const vocabularyHref = modeHref(lang, decodedLevel, 'vocabulary')
  // Die nächste Lektion beginnt mit derselben Frage wie ihr Schalter
  // (Wörter prüfen oder alle in Fach 1) — deshalb kein direkter Sprung in die Einstufung.
  const next: LessonsNext | null = open && vocabulary.due > 0 ? { href: vocabularyHref, hint: s.count('lessons_next_vocab', vocabulary.due) }
    : open && current ? { lesson: current.lesson, hint: s('lessons_next_lesson', { lesson: current.label }) }
      : null

  return (
    <VocabularyLessons key={`${user?.id ?? 'anonymous'}:${decodedLevel}:${lang}:${query.sitov_target ?? ''}`} sitovTarget={sitovTarget} lang={lang} level={decodedLevel} stations={stations} next={next}
      initialOwnWord={open && !sitovTarget ? sitovInitialWord : ''} initialOwnExample={open ? sitovInitialExample : ''}
      carryover={open ? status?.carryover : null} learnerId={user?.id} newItems={news.items} lessonIds={news.lessonIds}
      vocabularyHref={open ? vocabularyHref : null} vocabularyTranslations={translations}
      ownWords={open ? status?.ownWords ?? { lesson: OWN_WORDS_LESSON, total: 0, active: 0, learned: 0, untouched: 0, due: 0 } : undefined} />
  )
}
