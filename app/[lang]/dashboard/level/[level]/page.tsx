import { requestSession } from '@/lib/request-session'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { isSitovPlatformLevel, sitovLevelCopyKeys } from '@/lib/access/levels'
import { getDictionary } from '@/lib/dictionary'
import { loadLastActiveLevel, type LevelActivity } from '@/lib/last-active-level'
import { loadLevelLearningStatus, modeLock, type LevelLearningStatus } from '@/lib/learning-status-server'
import { toStations } from '@/lib/lesson-stations'
import { lessonsHref, modeHref, sitovLevelModes, type LearningMode } from '@/lib/mode-targets'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { lessonLabel } from '@/lib/vocabulary-own-words'
import ResumeCard, { type ResumeTarget } from '@/components/dashboard/ResumeCard'
import TrainerStatusTiles from '@/components/dashboard/TrainerStatusTiles'
import ExamEntry from '@/components/exam-preparation/ExamEntry'

const MODE_LABELS = { vocabulary: 'area_vocabulary', path: 'area_path', pronunciation: 'area_pronunciation', media: 'area_media', verbs: 'area_verbs' } as const
const CONTINUE_TO = { vocabulary: 'continue_to_vocabulary', path: 'continue_to_path', pronunciation: 'continue_to_pronunciation', media: 'continue_to_media', verbs: 'continue_to_verbs' } as const

/**
 * Niveau-Übersicht (Phase 2): oben „Weiter, wo du aufgehört hast", darunter
 * die fünf Modi im gleichen Karussell wie auf Home, mit je einer Kennzahl. Die
 * Vokabel-Lektionen liegen jetzt im Modus Vokabeln unter „Lektionen".
 */
export default async function LevelDashboard({ params }: {
  params: Promise<{ lang: string; level: string }>
}) {
  const { lang, level } = await params
  const decodedLevel = decodeURIComponent(level)
  const { supabase, user } = await requestSession()
  const [profile, dict, last] = await Promise.all([
    user ? loadLevelAccessProfile(supabase, user.id) : null,
    getDictionary(lang),
    loadLastActiveLevel(),
  ])
  const status = user ? await loadLevelLearningStatus({ supabase, userId: user.id, profile, level: decodedLevel, lang }) : null
  const s = studentTranslator(lang)
  const vocabularyT = createVocabularyTranslator((dict.vocabulary ?? {}) as VocabularyTranslations)
  const copy = dict.dashboard as Record<string, string>
  const [titleKey, descriptionKey] = isSitovPlatformLevel(decodedLevel) ? sitovLevelCopyKeys(decodedLevel) : []
  const locked = (mode: LearningMode) => modeLock(profile, decodedLevel, lang, mode) !== null
  const activity = last?.levels.find(entry => entry.level === decodedLevel) ?? null
  const place = (entry: LevelActivity) => {
    const detail = entry.mode === 'path' ? entry.topic ?? entry.unitLabel : entry.unitLabel && lessonLabel(entry.unitLabel, vocabularyT)
    return [s(MODE_LABELS[entry.mode!]), detail].filter(Boolean).join(' · ')
  }
  const target = resumeTarget({ lang, level: decodedLevel, status, activity, locked, s, place,
    currentLesson: toStations(status?.lessons ?? [], lesson => lessonLabel(lesson, vocabularyT)).find(station => station.state === 'current')?.label ?? null })

  return (
    <div className="space-y-8">
      <ResumeCard lang={lang} level={decodedLevel} title={titleKey ? copy[titleKey] ?? decodedLevel : decodedLevel}
        description={descriptionKey ? copy[descriptionKey] ?? '' : decodedLevel === 'B2' || decodedLevel === 'C1' ? s('level_verbs_description') : ''} target={target} />
      <TrainerStatusTiles lang={lang} level={decodedLevel} status={status} languageLocked={false} />
      {(decodedLevel === 'B1.1' || decodedLevel === 'B1.2') && <ExamEntry lang={lang} reference />}
    </div>
  )
}

/**
 * Ziel des großen Knopfs: die letzte Stelle, wenn es in diesem Niveau eine
 * Lernhandlung gibt und ihr Modus offen ist; sonst der erste sinnvolle Schritt.
 */
function resumeTarget({ lang, level, status, activity, locked, s, place, currentLesson }: {
  lang: string
  level: string
  status: LevelLearningStatus | null
  activity: LevelActivity | null
  locked: (mode: LearningMode) => boolean
  s: ReturnType<typeof studentTranslator>
  place: (entry: LevelActivity) => string
  currentLesson: string | null
}): ResumeTarget | null {
  const vocabulary = status?.vocabulary && !status.vocabulary.locked ? status.vocabulary : null
  const grammar = status?.grammar && !status.grammar.locked ? status.grammar : null
  const due = vocabulary?.due ?? 0
  const hintFor = (mode: LearningMode) => mode === 'vocabulary' && due > 0 ? s.count('lessons_next_vocab', due)
    : mode === 'path' && grammar && grammar.openTopics > 0 ? s('lessons_next_grammar', { count: grammar.openTopics }) : null
  const hrefFor = (mode: LearningMode) => mode === 'vocabulary' && vocabulary && due === 0 && vocabulary.activeWords + vocabulary.learned === 0
    ? lessonsHref(lang, level) : modeHref(lang, level, mode)

  if (activity?.mode && !locked(activity.mode)) {
    return { mode: activity.mode, href: hrefFor(activity.mode), place: place(activity), hint: hintFor(activity.mode), resumes: true }
  }
  if (vocabulary && due > 0) return { mode: 'vocabulary', href: modeHref(lang, level, 'vocabulary'), place: null, hint: hintFor('vocabulary'), resumes: false }
  if (vocabulary && currentLesson) return { mode: 'vocabulary', href: lessonsHref(lang, level), place: null, hint: s('lessons_next_lesson', { lesson: currentLesson }), resumes: false }
  if (grammar && grammar.openTopics > 0) return { mode: 'path', href: modeHref(lang, level, 'path'), place: null, hint: hintFor('path'), resumes: false }
  const first = sitovLevelModes(level).find(mode => !locked(mode))
  return first ? { mode: first, href: hrefFor(first), place: null, hint: s(CONTINUE_TO[first]), resumes: false } : null
}
