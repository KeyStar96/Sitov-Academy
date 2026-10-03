import { z } from 'zod'
import type { PhaseBucket } from './vocabulary-ui'

/**
 * Vertrag und Rechenhilfen der Lernanalyse je Lernmodus (Phase 11.3,
 * `get_learning_progress`, Migrationen 54 und 65). Dieselben Daten zeigen die
 * Lernanalyse der Lehrkraft und „Mein Fortschritt" der Lernenden.
 */
export const PROGRESS_RANGES = [7, 30, 90] as const
export type ProgressRange = typeof PROGRESS_RANGES[number]
export const DEFAULT_PROGRESS_RANGE: ProgressRange = 30
export const PROGRESS_MODES = ['vocabulary', 'verbs', 'path', 'pronunciation', 'media'] as const
export type ProgressMode = typeof PROGRESS_MODES[number]

export function progressRangeFrom(value: unknown): ProgressRange {
  const number = typeof value === 'string' ? Number(value) : value
  return PROGRESS_RANGES.find(range => range === number) ?? DEFAULT_PROGRESS_RANGE
}

const count = z.number().int().nonnegative()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timestamp = z.string().min(1)
export const phaseBucketSchema = z.object({
  key: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal('learned')]), count,
}).transform((value): PhaseBucket => ({ key: value.key, count: value.count }))

const verbAnswersSchema = z.object({ answers: count, correct: count })
const verbTenseSchema = z.enum(['present', 'perfect', 'past'])
const daySchema = z.object({
  date: isoDate,
  vocabulary: z.object({ answers: count, correct: count, learned: count, seconds: count }),
  verbs: z.object({ answers: count, correct: count, seconds: count, present: verbAnswersSchema, perfect: verbAnswersSchema, past: verbAnswersSchema }),
  focus: z.object({ answers: count, correct: count }),
  path: z.object({ answers: count, correct: count, stations: count, seconds: count }),
  pronunciation: z.object({ recordings: count, replies: count, seconds: count }),
  media: z.object({ views: count }),
})
export type ProgressDay = z.infer<typeof daySchema>

export const focusStatusSchema = z.enum(['active', 'mastered'])
const focusWordSchema = z.object({
  cardId: z.string().uuid(), word: z.string(), article: z.string().nullable(), level: z.string(),
  status: focusStatusSchema, stage: z.number().int().min(0).max(4), dueAt: timestamp.nullable(), due: z.boolean(),
  wrongCount: count, articleErrors: count, practiceCount: count, practiceCorrect: count, masteredAt: timestamp.nullable(),
})
export type ProgressFocusWord = z.infer<typeof focusWordSchema>

// Unbekannte Felder (z. B. `success`) entfernt zod; Fehlerantworten prüft der Aufrufer vorher.
export const learningProgressSchema = z.object({
  studentId: z.string().uuid(),
  level: z.string().nullable(),
  days: z.number().int().min(7).max(90),
  today: isoDate,
  timezone: z.literal('Europe/Berlin'),
  daily: z.array(daySchema).min(7).max(90),
  vocabulary: z.object({
    totalWords: count, inBox: count, learnedWords: count, learnedTotal: count,
    overallPercent: z.number().int().min(0).max(100), buckets: z.array(phaseBucketSchema).length(7),
  }),
  verbs: z.object({
    totalVerbs: count, inBox: count, totalForms: count, practicedForms: count, confidentForms: count, dueForms: count,
    buckets: z.array(z.object({ box: z.number().int().min(0).max(7), count })).length(8),
    tenses: z.array(z.object({ tense: verbTenseSchema, totalForms: count, practicedForms: count, confidentForms: count, dueForms: count })).max(3),
  }),
  focus: z.object({ active: count, due: count, mastered: count, articleWords: count, words: z.array(focusWordSchema) }),
  path: z.object({
    totalStations: count, completedStations: count, totalUnits: count, completedUnits: count,
    tests: z.array(z.object({ completedAt: timestamp, percentage: z.number().min(0).max(100), passed: z.boolean(), title: z.string().nullable() })),
  }),
  pronunciation: z.object({ totalTexts: count, practicedTexts: count, recordings: count, awaitingReply: count }),
  media: z.object({
    totalMedia: count, viewedMedia: count,
    recent: z.array(z.object({ kind: z.enum(['video', 'link', 'presentation']), title: z.string(), viewedAt: timestamp, views: count })),
  }),
}).superRefine((data, ctx) => {
  const ordered = data.daily.every((day, index) => index === 0 || day.date > data.daily[index - 1].date)
  const graded = data.daily.every(day => day.vocabulary.correct <= day.vocabulary.answers
    && day.focus.correct <= day.focus.answers && day.path.correct <= day.path.answers
    && day.verbs.correct <= day.verbs.answers
    && day.verbs.answers === day.verbs.present.answers + day.verbs.perfect.answers + day.verbs.past.answers
    && day.verbs.correct === day.verbs.present.correct + day.verbs.perfect.correct + day.verbs.past.correct
    && [day.verbs.present, day.verbs.perfect, day.verbs.past].every(tense => tense.correct <= tense.answers))
  const verbs = data.verbs
  const consistentVerbs = verbs.inBox <= verbs.totalVerbs && verbs.practicedForms <= verbs.totalForms
    && verbs.confidentForms <= verbs.practicedForms && verbs.dueForms <= verbs.totalForms
    && verbs.buckets.every((bucket, index) => bucket.box === index)
    && verbs.buckets.reduce((sum, bucket) => sum + bucket.count, 0) === verbs.totalForms
    && verbs.buckets[0].count === verbs.totalForms - verbs.practicedForms
    && verbs.buckets[6].count + verbs.buckets[7].count === verbs.confidentForms
    && new Set(verbs.tenses.map(tense => tense.tense)).size === verbs.tenses.length
    && verbs.tenses.every(tense => tense.practicedForms <= tense.totalForms && tense.confidentForms <= tense.practicedForms && tense.dueForms <= tense.totalForms)
    && verbs.tenses.reduce((sum, tense) => sum + tense.totalForms, 0) === verbs.totalForms
    && verbs.tenses.reduce((sum, tense) => sum + tense.practicedForms, 0) === verbs.practicedForms
    && verbs.tenses.reduce((sum, tense) => sum + tense.confidentForms, 0) === verbs.confidentForms
    && verbs.tenses.reduce((sum, tense) => sum + tense.dueForms, 0) === verbs.dueForms
  if (data.daily.length !== data.days || !ordered || !graded || !consistentVerbs || data.daily.at(-1)?.date !== data.today) {
    ctx.addIssue({ code: 'custom', message: 'Inconsistent learning progress response' })
  }
})
export type LearningProgress = z.output<typeof learningProgressSchema>

/** Anteil richtiger Antworten in ganzen Prozent; `null`, wenn nichts beantwortet wurde. */
export function percent(correct: number, total: number): number | null {
  return total > 0 ? Math.round(correct / total * 100) : null
}

/**
 * Quote je Tag für die Linie im Diagramm. Ab 30 Tagen ein gleitender
 * 7-Tage-Wert (Summe richtig / Summe beantwortet der letzten 7 Tage): Tage
 * ohne Lernen zerreißen die Linie sonst in viele Stücke. Bis 7 Tage der Tag selbst.
 */
export function accuracyLine(daily: readonly ProgressDay[], pick: (day: ProgressDay) => { answers: number; correct: number }): (number | null)[] {
  const window = daily.length > 7 ? 7 : 1
  return daily.map((_, index) => {
    const slice = daily.slice(Math.max(0, index - window + 1), index + 1).map(pick)
    return percent(slice.reduce((sum, day) => sum + day.correct, 0), slice.reduce((sum, day) => sum + day.answers, 0))
  })
}

/** Beantwortete und richtige Fragen eines Tages: Vokabeltrainer, Problemwörter, Verbtrainer und Lernpfad. */
export function answeredOn(day: ProgressDay) {
  const answers = day.vocabulary.answers + day.focus.answers + day.verbs.answers + day.path.answers
  const correct = day.vocabulary.correct + day.focus.correct + day.verbs.correct + day.path.correct
  return { answers, correct, wrong: answers - correct, percent: percent(correct, answers) }
}

export function studySeconds(day: ProgressDay) {
  return day.vocabulary.seconds + day.verbs.seconds + day.path.seconds + day.pronunciation.seconds
}

/** Summen über den ganzen Zeitraum (für Kennzahlen und Durchschnitt). */
export function rangeTotals(daily: readonly ProgressDay[]) {
  const sum = (pick: (day: ProgressDay) => number) => daily.reduce((total, day) => total + pick(day), 0)
  const answers = sum(day => answeredOn(day).answers)
  const correct = sum(day => answeredOn(day).correct)
  const activeDays = daily.filter(day => answeredOn(day).answers + day.pronunciation.recordings + day.media.views > 0 || studySeconds(day) > 0).length
  return {
    answers, correct, percent: percent(correct, answers), activeDays, seconds: sum(studySeconds),
    vocabulary: { answers: sum(day => day.vocabulary.answers), correct: sum(day => day.vocabulary.correct), learned: sum(day => day.vocabulary.learned), seconds: sum(day => day.vocabulary.seconds) },
    verbs: { answers: sum(day => day.verbs.answers), correct: sum(day => day.verbs.correct), seconds: sum(day => day.verbs.seconds) },
    focus: { answers: sum(day => day.focus.answers), correct: sum(day => day.focus.correct) },
    path: { answers: sum(day => day.path.answers), correct: sum(day => day.path.correct), stations: sum(day => day.path.stations), seconds: sum(day => day.path.seconds) },
    pronunciation: { recordings: sum(day => day.pronunciation.recordings), replies: sum(day => day.pronunciation.replies), seconds: sum(day => day.pronunciation.seconds) },
    media: { views: sum(day => day.media.views) },
  }
}

/**
 * Summenkurve gelernter Wörter. Phase 7 ist endgültig, deshalb ergibt sich der
 * Stand vor dem Zeitraum aus dem heutigen Stand minus den Lerntagen im Zeitraum.
 */
export function learnedCurve(progress: Pick<LearningProgress, 'daily' | 'vocabulary'>): number[] {
  const inRange = progress.daily.reduce((total, day) => total + day.vocabulary.learned, 0)
  let running = Math.max(0, progress.vocabulary.learnedTotal - inRange)
  return progress.daily.map(day => (running += day.vocabulary.learned))
}

/** Heutiger Tag im Vergleich zum Durchschnitt der aktiven Vortage im Zeitraum. */
export function todaySummary(daily: readonly ProgressDay[]) {
  const today = daily.at(-1)
  if (!today) return null
  const current = answeredOn(today)
  const before = daily.slice(0, -1).map(answeredOn).filter(day => day.answers > 0)
  const averagePercent = percent(before.reduce((total, day) => total + day.correct, 0), before.reduce((total, day) => total + day.answers, 0))
  return { ...current, seconds: studySeconds(today), recordings: today.pronunciation.recordings, views: today.media.views, averagePercent }
}
