import { createClient } from '@/utils/supabase/server'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { getDictionary } from '@/lib/dictionary'
import { loadLevelLearningStatus } from '@/lib/learning-status-server'
import { toStations } from '@/lib/level-path'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { lessonLabel, OWN_WORDS_LESSON } from '@/lib/vocabulary-own-words'
import LevelPath, { type PathNext } from '@/components/dashboard/LevelPath'
import TrainerStatusTiles from '@/components/dashboard/TrainerStatusTiles'
import TrainerLanguageRequired from '@/components/dashboard/TrainerLanguageRequired'

const LEVEL_COPY: Record<string, [string, string]> = {
  'A1.1': ['level_a11_title', 'level_a11_desc'], 'A1.2': ['level_a12_title', 'level_a12_desc'],
  'A2.1': ['level_a21_title', 'level_a21_desc'], 'A2.2': ['level_a22_title', 'level_a22_desc'],
  'B1.1': ['level_b11_title', 'level_b11_desc'], 'B1.2': ['level_b12_title', 'level_b12_desc'],
}

/**
 * Der Lernweg eines Niveaus: oben Stand und *ein* Weiter-Knopf, darunter die
 * Lektionen als Stationen mit ihrem Lernbox-Schalter und „Eigene Wörter", am
 * Ende alle Lernbereiche mit ihrem Stand.
 */
export default async function LevelDashboard({ params }: {
  params: Promise<{ lang: string; level: string }>
}) {
  const { lang, level } = await params
  const decodedLevel = decodeURIComponent(level)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [profile, dict] = await Promise.all([
    user ? loadLevelAccessProfile(supabase, user.id) : null,
    getDictionary(lang),
  ])
  const status = user ? await loadLevelLearningStatus({ supabase, userId: user.id, profile, level: decodedLevel, lang }) : null
  const s = studentTranslator(lang)
  const vocabularyT = createVocabularyTranslator((dict.vocabulary ?? {}) as VocabularyTranslations)
  const copy = dict.dashboard as Record<string, string>
  const [titleKey, descriptionKey] = LEVEL_COPY[decodedLevel] ?? []
  const base = `/${lang}/dashboard/level/${encodeURIComponent(decodedLevel)}`
  const stations = toStations(status?.lessons ?? [], lesson => lessonLabel(lesson, vocabularyT))

  const vocabulary = status?.vocabulary
  const vocabularyOpen = !!vocabulary && !vocabulary.locked
  const current = stations.find(station => station.state === 'current')
  const grammar = status?.grammar
  // Die nächste Lektion beginnt immer mit derselben Frage wie ihr Schalter
  // (Wörter prüfen oder alle in Fach 1) — deshalb kein direkter Sprung in die Einstufung.
  const next: PathNext | null = vocabularyOpen && vocabulary.due > 0 ? { href: `${base}/vocabulary`, hint: s.count('path_next_vocab', vocabulary.due) }
    : vocabularyOpen && current ? { lesson: current.lesson, hint: s('path_next_lesson', { lesson: current.label }) }
      : grammar && !grammar.locked && grammar.openTopics > 0 ? { href: `${base}/exercises`, hint: s('path_next_grammar', { count: grammar.openTopics }) }
        : vocabularyOpen && stations.length > 0 ? { href: `${base}/vocabulary`, hint: s('station_practice') }
          : null

  return (
    <div className="space-y-8">
      {lang === 'de' && <TrainerLanguageRequired lang={lang} />}
      <LevelPath lang={lang} level={decodedLevel} title={titleKey ? copy[titleKey] ?? decodedLevel : decodedLevel}
        description={descriptionKey ? copy[descriptionKey] ?? '' : ''} stations={stations} next={next}
        vocabularyHref={vocabularyOpen ? `${base}/vocabulary` : null} vocabularyTranslations={(dict.vocabulary ?? {}) as VocabularyTranslations}
        ownWords={vocabularyOpen ? status?.ownWords ?? { lesson: OWN_WORDS_LESSON, total: 0, active: 0, learned: 0, untouched: 0, due: 0 } : undefined} />
      <TrainerStatusTiles lang={lang} level={decodedLevel} status={status} languageLocked={lang === 'de'} />
    </div>
  )
}
