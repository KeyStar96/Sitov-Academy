import 'server-only'

import { cache } from 'react'
import { getVocabularyOverview } from '@/app/actions/vocabulary'
import { getExercises } from '@/app/actions/exercises'
import { getPronunciationPrompts } from '@/app/actions/pronunciation'
import { hasLevelAccess, hasTrainerAccess, type LevelAccessProfile } from '@/lib/access/levels'
import { mapVideo, videoQuery } from '@/lib/learning-catalog'
import { learningResourceUrl } from '@/lib/video-links'
import { isOwnWordsLesson } from '@/lib/vocabulary-own-words'
import type { LessonStat } from '@/lib/types/vocabulary'
import { berlinNow } from '@/lib/dashboard-next-course'
import { createClient } from '@/utils/supabase/server'
import { LEARNING_MODES, MODE_TRAINERS, type LearningMode } from '@/lib/mode-targets'
import type { ModeDockEntry, ModeLock } from '@/components/dashboard/ModeDock'

type Client = Awaited<ReturnType<typeof createClient>>

/** Medien gelten so lange als „neu", wie sie jünger als diese Spanne sind. */
const FRESH_MEDIA_DAYS = 14

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
  grammar: { locked: boolean; total: number; solved: number; topics: number; openTopics: number } | null
  pronunciation: { locked: boolean; texts: number; open: number; waiting: number; unread: number } | null
  media: { locked: boolean; total: number; fresh: number } | null
  /** Vokabel-Lektionen des Kurses in ihrer Reihenfolge — die Stationen unter „Lektionen". */
  lessons: LessonStation[]
  /** „Eigene Wörter" dieses Niveaus; `null`, solange nichts geladen werden konnte. */
  ownWords: LessonStation | null
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
const pronunciationStatus = cache(async (userId: string, level: string) => loadPronunciation(await createClient(), userId, level))

async function loadPronunciation(supabase: Client, userId: string, level: string) {
  const [prompts, submissions] = await Promise.all([
    getPronunciationPrompts(level),
    supabase.from('submissions').select('id,prompt_id,status,pronunciation_messages(sender_role,seen_at)')
      .eq('auth_user_id', userId).eq('level', level),
  ])
  if (submissions.error) throw new Error('submissions_unavailable')
  const recorded = new Set((submissions.data ?? []).map(row => row.prompt_id).filter(Boolean))
  const unread = (submissions.data ?? []).reduce((sum, row) => sum + (row.pronunciation_messages ?? [])
    .filter(message => message.sender_role !== 'student' && !message.seen_at).length, 0)
  return {
    texts: prompts.length,
    open: prompts.filter(prompt => !recorded.has(prompt.id)).length,
    waiting: (submissions.data ?? []).filter(row => row.status === 'pending').length,
    unread,
  }
}

async function loadMedia(supabase: Client, level: string) {
  const [videos, documents] = await Promise.all([
    videoQuery(supabase).eq('unit.level', level),
    supabase.from('lms_presentation_asset').select('asset_id,created_at,folder:lms_media_folder!inner(level)').eq('folder.level', level),
  ])
  if (videos.error || documents.error) throw new Error('media_unavailable')
  const since = Date.now() - FRESH_MEDIA_DAYS * 86_400_000
  const dates = [
    ...(videos.data ?? []).map(mapVideo)
      .filter(video => video.is_active && ((video.storage_path && video.file_size) || learningResourceUrl(video.source_url)))
      .map(video => video.created_at),
    ...(documents.data ?? []).map(document => document.created_at),
  ]
  return { total: dates.length, fresh: dates.filter(date => date && Date.parse(date) >= since).length }
}

/**
 * Lädt den Status eines Niveaus. Die Trainer außer den Videos brauchen eine
 * nicht-deutsche Oberfläche (Übersetzungen); dann sind sie gesperrt und
 * werden gar nicht erst gelesen.
 */
export async function loadLevelLearningStatus({ supabase, userId, profile, level, lang }: {
  supabase: Client
  userId: string
  profile: LevelAccessProfile | null
  level: string
  lang: string
}): Promise<LevelLearningStatus> {
  const languageLocked = lang === 'de'
  const locked = {
    vocabulary: languageLocked || !hasTrainerAccess(profile, level, 'vocabulary'),
    grammar: languageLocked || !hasTrainerAccess(profile, level, 'exercises'),
    pronunciation: languageLocked || !hasTrainerAccess(profile, level, 'pronunciation'),
    media: !hasLevelAccess(profile, level),
  }
  const [vocabulary, exercises, pronunciation, media] = await Promise.all([
    locked.vocabulary ? null : settle(() => vocabularyOverview(level), () => console.error('[learning-status] vocabulary_unavailable')),
    locked.grammar ? null : settle(() => getExercises(level, lang), () => console.error('[learning-status] grammar_unavailable')),
    locked.pronunciation ? null : settle(() => pronunciationStatus(userId, level), () => console.error('[learning-status] pronunciation_unavailable')),
    locked.media ? null : settle(() => loadMedia(supabase, level), () => console.error('[learning-status] media_unavailable')),
  ])

  const topics = new Map<string, boolean>()
  for (const exercise of exercises ?? []) topics.set(exercise.topic, (topics.get(exercise.topic) ?? true) && exercise.completed)
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
        total: vocabulary.stats.reduce((sum, stat) => sum + stat.total, 0), learned: vocabulary.box.learned,
      },
    grammar: locked.grammar ? { locked: true, total: 0, solved: 0, topics: 0, openTopics: 0 }
      : exercises && {
        locked: false, total: exercises.length, solved: exercises.filter(exercise => exercise.completed).length,
        topics: topics.size, openTopics: [...topics.values()].filter(done => !done).length,
      },
    pronunciation: locked.pronunciation ? { locked: true, texts: 0, open: 0, waiting: 0, unread: 0 }
      : pronunciation && { locked: false, ...pronunciation },
    media: locked.media ? { locked: true, total: 0, fresh: 0 } : media && { locked: false, ...media },
    lessons: courseLessons.map(station),
    ownWords: own ? station(own) : null,
  }
}

/**
 * Warum ein Modus gesperrt ist. Die Mediathek folgt allein der
 * Niveau-Freigabe (wie ihre Route); die übrigen Modi brauchen eine nicht
 * deutsche Oberfläche und die Trainer-Freigabe der Lehrkraft.
 */
export function modeLock(profile: LevelAccessProfile | null, level: string, lang: string, mode: LearningMode): ModeLock {
  if (mode === 'media') return hasLevelAccess(profile, level) ? null : 'teacher'
  if (lang === 'de' || profile?.ui_language === 'de') return 'language'
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
  const [overview, speech] = await Promise.all([
    lock('vocabulary') ? null : settle(() => vocabularyOverview(level), () => console.error('[mode-dock] vocabulary_unavailable')),
    lock('pronunciation') ? null : settle(() => pronunciationStatus(userId, level), () => console.error('[mode-dock] pronunciation_unavailable')),
  ])
  return LEARNING_MODES.map(mode => ({
    mode,
    lock: lock(mode),
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
