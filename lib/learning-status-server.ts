import 'server-only'

import { cache } from 'react'
import { getVocabularyOverview } from '@/app/actions/vocabulary'
import { readSitovLearningPathStatistics } from '@/lib/sitov-learning-path-statistics'
import { sitovPronunciationPretestActionResultSchema, sitovPronunciationPretestCatalogSchema } from '@/lib/sitov-pronunciation-pretest-contract'
import { requestSession } from '@/lib/request-session'
import { hasConfiguredTrainerAccess, hasTrainerAccess, type LevelAccessProfile } from '@/lib/access/levels'
import { mapVideo, videoQuery } from '@/lib/learning-catalog'
import { learningResourceUrl } from '@/lib/video-links'
import { isOwnWordsLesson } from '@/lib/vocabulary-own-words'
import type { LessonStat, VocabularyCarryoverSummary } from '@/lib/types/vocabulary'
import { berlinNow } from '@/lib/dashboard-next-course'
import { createClient } from '@/utils/supabase/server'
import { LEARNING_MODES, MODE_TRAINERS, sitovLevelModes, type LearningMode } from '@/lib/mode-targets'
import { modeIsNew } from '@/lib/learning-new'
import { loadLearningNewCounts } from '@/lib/learning-new-server'
import { loadSitovVerbTrainer, sitovVerbStats } from '@/lib/verbs/server'
import type { ModeDockEntry, ModeLock } from '@/components/dashboard/ModeDock'

type Client = Awaited<ReturnType<typeof createClient>>

/**
 * Was in jedem Trainer eines Niveaus gerade wartet — die Grundlage der
 * Modus-Karten „Vokabeln · 48 fällig" auf Startseite und Niveau-Seite und der
 * Zähler im Modus-Dock.
 *
 * Jeder Bereich ist unabhängig: `null` heißt „konnte nicht geladen werden"
 * und wird als neutrale Kachel ohne Zahl gezeigt. Ein Ausfall darf nie als
 * „nichts zu tun" erscheinen (R10), aber auch nicht die Seite mitreißen.
 */
export interface LevelLearningStatus {
  level: string
  vocabulary: { locked: boolean; due: number; activeWords: number; total: number; learned: number } | null
  /** Kernknoten und Themen des Lernpfads; ein Thema ist nach bestandenem Test abgeschlossen. */
  grammar: { locked: boolean; total: number; solved: number; topics: number; openTopics: number; currentTopic?: number | null } | null
  pronunciation: { locked: boolean; texts: number; open: number; waiting: number; unread: number; readyTexts?: number; lockedTexts?: number; readinessTier?: number } | null
  media: { locked: boolean; total: number; fresh: number } | null
  /** Modi mit „Neu"-Kennzeichen (Phase 6.1): neue Inhalte oder der Modus selbst. */
  verbs?: { locked: boolean; total: number; selected: number; due: number; mastered: number } | null
  fresh?: Record<LearningMode, boolean>
  /** Vokabel-Lektionen des Kurses in ihrer Reihenfolge — die Stationen unter „Lektionen". */
  lessons: LessonStation[]
  /** „Eigene Wörter" dieses Niveaus; `null`, solange nichts geladen werden konnte. */
  ownWords: LessonStation | null
  carryover?: VocabularyCarryoverSummary | null
}

export interface LessonStation {
  lesson: string
  total: number
  /** Wörter im Karteikasten (Phasen 1–6). */
  active: number
  learned: number
  untouched: number
  due: number
  /** Unter „Lektionen" ausgeschaltet: Lernstand bleibt, geübt wird nicht. */
  paused?: boolean
}

async function settle<T>(work: () => Promise<T>, report: () => void): Promise<T | null> {
  try { return await work() }
  catch { report(); return null }
}

/**
 * Pro Anfrage nur einmal gelesen: Das Niveau-Layout (Modus-Dock) und die
 * Seite darunter brauchen dieselben Zahlen.
 */
const vocabularyOverview = cache((level: string) => getVocabularyOverview(level))
const pronunciationStatus = cache(async (userId: string, level: string) => loadPronunciation((await requestSession()).supabase, userId, level))

async function loadPronunciation(supabase: Client, userId: string, level: string) {
  const [catalogResponse, submissions] = await Promise.all([
    supabase.rpc('sitov_get_pronunciation_pretests', { p_level: level }),
    supabase.from('submissions').select('id,prompt_id,status,pronunciation_messages(sender_role,seen_at)')
      .eq('auth_user_id', userId).eq('level', level),
  ])
  const catalog = sitovPronunciationPretestActionResultSchema(sitovPronunciationPretestCatalogSchema).safeParse(catalogResponse.data)
  if (submissions.error || catalogResponse.error || !catalog.success || catalog.data.ok === false) throw new Error('pronunciation_catalog_unavailable')
  const texts = catalog.data.data
  const ready = texts.filter(text => text.status === 'passed')
  const recorded = new Set((submissions.data ?? []).map(row => row.prompt_id).filter(Boolean))
  const unread = (submissions.data ?? []).reduce((sum, row) => sum + (row.pronunciation_messages ?? [])
    .filter(message => message.sender_role !== 'student' && !message.seen_at).length, 0)
  return {
    texts: texts.length,
    open: texts.filter(text => text.status !== 'locked' && !recorded.has(text.textId)).length,
    readyTexts: ready.length,
    lockedTexts: texts.filter(text => text.status === 'locked').length,
    waiting: (submissions.data ?? []).filter(row => row.status === 'pending').length,
    unread,
  }
}

async function loadMedia(supabase: Client, level: string) {
  const [videos, documents] = await Promise.all([
    videoQuery(supabase).eq('unit.level', level),
    supabase.from('lms_presentation_asset').select('asset_id,folder:lms_media_folder!inner(level)').eq('folder.level', level),
  ])
  if (videos.error || documents.error) throw new Error('media_unavailable')
  const playable = (videos.data ?? []).map(mapVideo)
    .filter(video => video.is_active && ((video.storage_path && video.file_size) || learningResourceUrl(video.source_url)))
  return { total: playable.length + (documents.data ?? []).length }
}

/**
 * Lädt bestehende Lernstände mit kommerzieller Autorisierung. Die Interface-
 * Sprache sperrt keinen Bereich; Aussprache folgt dem individuellen Vortest.
 */
export async function loadLevelLearningStatus({ supabase, userId, profile, level, lang }: {
  supabase: Client
  userId: string
  profile: LevelAccessProfile | null
  level: string
  lang: string
}): Promise<LevelLearningStatus> {
  const locked = {
    vocabulary: !hasTrainerAccess(profile, level, 'vocabulary'),
    grammar: !hasTrainerAccess(profile, level, 'exercises'),
    pronunciation: !hasTrainerAccess(profile, level, 'pronunciation'),
    media: !hasConfiguredTrainerAccess(profile, level, 'videos'),
    verbs: !hasTrainerAccess(profile, level, 'verbs'),
  }
  const [vocabulary, path, pronunciation, media, news, verbs] = await Promise.all([
    locked.vocabulary ? null : settle(() => vocabularyOverview(level), () => console.error('[learning-status] vocabulary_unavailable')),
    locked.grammar ? null : settle(() => readSitovLearningPathStatistics(supabase, level, lang), () => console.error('[learning-status] path_unavailable')),
    locked.pronunciation ? null : settle(() => pronunciationStatus(userId, level), () => console.error('[learning-status] pronunciation_unavailable')),
    locked.media ? null : settle(() => loadMedia(supabase, level), () => console.error('[learning-status] media_unavailable')),
    loadLearningNewCounts(),
    locked.verbs ? null : settle(async () => { const result = await loadSitovVerbTrainer(level, lang); if (result.error || !result.data) throw new Error('verbs_unavailable'); return sitovVerbStats(result.data) }, () => console.error('[learning-status] verbs_unavailable')),
  ])
  const levelNew = news?.levels[level]

  const courseLessons = (vocabulary?.stats ?? []).filter(stat => !isOwnWordsLesson(stat.lesson))
  const station = ({ lesson, total, active, learned, untouched, due, paused }: LessonStat): LessonStation =>
    ({ lesson, total, active, learned, untouched, due, paused: paused === true })
  const own = (vocabulary?.stats ?? []).find(stat => isOwnWordsLesson(stat.lesson))

  return {
    level,
    vocabulary: locked.vocabulary ? { locked: true, due: 0, activeWords: 0, total: 0, learned: 0 }
      : vocabulary && {
        // Lernbox-Zahlen zählen nur eingeschaltete Lektionen; `total` sind alle
        // Wörter des Niveaus — daran erkennt die Startseite „noch nichts begonnen".
        locked: false, due: vocabulary.dueCards, activeWords: vocabulary.box.inPhases,
        total: vocabulary.stats.reduce((sum, stat) => sum + stat.total, 0), learned: vocabulary.ownBox.learned,
      },
    grammar: locked.grammar ? { locked: true, total: 0, solved: 0, topics: 0, openTopics: 0 }
      : path && { locked: false, ...path },
    pronunciation: locked.pronunciation ? { locked: true, texts: 0, open: 0, waiting: 0, unread: 0 }
      : pronunciation && { locked: false, ...pronunciation },
    // „Neu" pro Person aus der Datenbank (Migration 42); ersetzt die frühere 14-Tage-Regel der Medien.
    media: locked.media ? { locked: true, total: 0, fresh: 0 } : media && { locked: false, ...media, fresh: levelNew?.modes.media ?? 0 },
    verbs: locked.verbs ? { locked: true, total: 0, selected: 0, due: 0, mastered: 0 } : verbs && { locked: false, ...verbs },
    fresh: Object.fromEntries(LEARNING_MODES.map(mode => [mode, modeIsNew(levelNew, mode)])) as Record<LearningMode, boolean>,
    lessons: courseLessons.map(station),
    ownWords: own ? station(own) : null,
    carryover: vocabulary?.carryover ?? null,
  }
}

/**
 * Kommerzielle Modusfreigabe, unabhängig von der Interface-Sprache.
 * Hochgeladene Medien behalten ihre bestehende Niveau-Freigabe.
 */
export function modeLock(profile: LevelAccessProfile | null, level: string, _lang: string, mode: LearningMode): ModeLock {
  if (mode === 'media') return hasConfiguredTrainerAccess(profile, level, 'videos') ? null : 'teacher'
  if (mode === 'verbs') return hasTrainerAccess(profile, level, 'verbs') ? null : 'teacher'
  return hasTrainerAccess(profile, level, MODE_TRAINERS[mode]) ? null : 'teacher'
}

/** Einträge des Modus-Docks mit Sperren und Zählern (fällige Karten, ungelesene Antworten). */
export async function loadModeDock({ userId, profile, level, lang }: {
  userId: string
  profile: LevelAccessProfile | null
  level: string
  lang: string
}): Promise<ModeDockEntry[]> {
  const lock = (mode: LearningMode) => modeLock(profile, level, lang, mode)
  const [overview, speech, news] = await Promise.all([
    lock('vocabulary') ? null : settle(() => vocabularyOverview(level), () => console.error('[mode-dock] vocabulary_unavailable')),
    lock('pronunciation') ? null : settle(() => pronunciationStatus(userId, level), () => console.error('[mode-dock] pronunciation_unavailable')),
    loadLearningNewCounts(),
  ])
  return sitovLevelModes(level).map(mode => ({
    mode,
    lock: lock(mode),
    fresh: !lock(mode) && modeIsNew(news?.levels[level], mode),
    count: mode === 'vocabulary' ? overview?.dueCards : mode === 'pronunciation' ? speech?.unread : undefined,
  }))
}

/** Montag bis Sonntag der laufenden Berliner Woche, als `YYYY-MM-DD`. */
export function currentBerlinWeek(now = new Date()): string[] {
  const today = berlinNow(now).date
  const noon = new Date(`${today}T12:00:00Z`)
  const offset = (noon.getUTCDay() + 6) % 7
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(noon)
    day.setUTCDate(noon.getUTCDate() - offset + index)
    return day.toISOString().slice(0, 10)
  })
}

/** Lerntage der laufenden Woche (Migration 24). Fehlt die Tabelle noch, bleibt der Kalender leer statt die Seite zu stören. */
export async function loadWeekActivity(supabase: Client, userId: string, now = new Date()): Promise<{ days: string[]; learned: string[]; today: string } | null> {
  const days = currentBerlinWeek(now)
  const { data, error } = await supabase.from('learning_activity_days').select('day')
    .eq('auth_user_id', userId).gte('day', days[0]).lte('day', days[6])
  if (error) { console.error('[learning-status] activity_unavailable'); return null }
  return { days, learned: (data ?? []).map(row => row.day), today: berlinNow(now).date }
}
