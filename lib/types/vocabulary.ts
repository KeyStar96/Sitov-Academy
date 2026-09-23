import type { LeitnerBox, LeitnerPhase, VocabularyReviewMode } from '@/lib/leitner'
import type { BoxBucketKey, BoxSummary, LessonBoxStat, WordBoxState } from '@/lib/vocabulary-box'
import type { SoftErrorReason } from '@/lib/answer-grading'
import type { Database } from '@/supabase/database.types'
import type { UiLocale } from '@/lib/locale-routing'
import { resolveVocabularyTranslation, vocabularyNativeLocale, type VocabularySourceLanguage } from '@/lib/vocabulary-languages'

export type VocabularyDirection = 'de_to_native' | 'native_to_de'
export type VocabularyFormat = 'word' | 'sentence'

export type VocabularyCardRow = import('@/lib/learning-content').VocabularyContentRow

/** Felder der Vokabelkarte, die der Trainer tatsächlich benötigt. */
export interface VocabularyCardView {
  id: string
  lesson: string
  level: string
  word_de: string
  article: string | null
  plural: string | null
  image_url: string | null
  audio_url: string | null
}

/** Eine fällige Karte inklusive aufgelöstem Lernstand und Übersetzung. */
export interface DueVocabularyCard {
  progressId: string
  direction: VocabularyDirection
  format: VocabularyFormat
  /**
   * Serverseitig aus dem Lernstand festgelegter Abfragemodus. `flashcard` zeigt
   * die „Kenn ich / Kenn ich nicht"-Selbsteinschätzung, `typed` die Texteingabe.
   */
  mode: VocabularyReviewMode
  prompt: string
  /** Actual language of the prompt, including an explicitly selected fallback. */
  promptLanguage: UiLocale
  /** German context is omitted from unrevealed sentence prompts. */
  contextSentence: string | null
  /**
   * Die deutsche Musterlösung für die Karteikarten-Rückseite eines Satzes.
   * Nur bei Sätzen gesetzt; Wortkarten leiten ihre Lösung aus `card`/
   * `translation` ab. Sätze dürfen seit Phase 5.9 als Karteikarte gelernt
   * werden, und die Rückseite braucht dafür den deutschen Satz — genauso wie
   * eine Wortkarte ihre Lösung bereits im Payload trägt. Die Bewertung bleibt
   * bei PostgreSQL (R5); dies ist reine Anzeige.
   */
  solution: string | null
  box: LeitnerBox
  phase: LeitnerPhase
  card: VocabularyCardView
  /**
   * Übersetzung passend zur Muttersprache – serverseitig aufgelöst, damit die
   * Auswahl-Logik nicht im Client dupliziert wird.
   */
  translation: string
  /** Steuert die halbierten Intervalle für kontrastiv schwere Vokabeln. */
  isHardForNativeLanguage: boolean
}

/** Identity belongs to the same authenticated request that produced these cards. */
export interface VocabularySession {
  learnerId: string | null
  cards: DueVocabularyCard[]
  deferredCount: number
  previousCardId: string | null
}

export interface VocabularyAssessmentSession {
  learnerId: string | null
  cards: VocabularyAssessmentCard[]
}

/** One uninitialized direction, so interrupted assessments resume precisely. */
export interface VocabularyAssessmentCard {
  plural: string | null
  id: string
  word_de: string
  article: string | null
  translation: string
  translationLanguage: VocabularySourceLanguage
  direction: VocabularyDirection
}

/**
 * Lernstand einer Lektion für die Übersichtsseite.
 *
 * Die Zählung lebt in `lib/vocabulary-box.ts`, weil sie dieselben Definitionen
 * von „gelernt" und „fällig" braucht wie die Fächer-Übersicht.
 */
export type LessonStat = LessonBoxStat

export interface SubmitVocabularyAnswerInput {
  progressId: string
  /** Authenticated identity captured when the learning screen was loaded. */
  expectedLearnerId?: string
  /** Reuse this UUID with an identical payload when retrying a queued answer. */
  requestId?: string
  typedAnswer: string
  uiLanguage?: string
}

/** Selbsteinschätzung im Karteikarten-Modus; der Server entscheidet den Lernstand. */
export interface SubmitVocabularySelfRatingInput {
  progressId: string
  /** Authenticated identity captured when the learning screen was loaded. */
  expectedLearnerId?: string
  /** Reuse this UUID with an identical payload when retrying a queued rating. */
  requestId?: string
  /** Die Selbsteinschätzung des Lernenden: „Kenn ich" = true. */
  known: boolean
  uiLanguage?: string
}

export interface SubmitVocabularyAnswerResult {
  success: boolean
  isCorrect?: boolean
  correctAnswer?: string
  isAlternative?: boolean
  softError?: SoftErrorReason | null
  error?: 'invalid_input' | 'spacing_required' | 'save_failed'
  previousPhase?: LeitnerPhase
  newPhase?: LeitnerPhase
  becameLearned?: boolean
  movedBack?: boolean
  intervalInDays?: number
}

/**
 * Wiederholung einer falsch beantworteten Karte in derselben Sitzung. Sie wird
 * wie der erste Versuch aus dem gespeicherten Inhalt bewertet, ändert aber
 * weder Phase noch Termin: Beim Phase-6-System zählt nur der erste Versuch des
 * Tages.
 */
export interface CheckVocabularyRetryInput {
  progressId: string
  expectedLearnerId?: string
  typedAnswer: string
  uiLanguage?: string
}

export interface CheckVocabularyRetryResult {
  success: boolean
  isCorrect?: boolean
  correctAnswer?: string
  isAlternative?: boolean
  softError?: SoftErrorReason | null
  error?: 'invalid_input' | 'check_failed'
}

export interface InitializeLessonResult {
  success: boolean
  added: number
}

/**
 * Einzelne Vokabel für die Lektions-Detailansicht, inklusive persönlichem
 * Lernstand. `phase` ist `null`, solange die Vokabel noch nicht manuell oder
 * per Einstufung in den Karteikasten übernommen wurde.
 */
export interface LessonCardView {
  id: string
  word_de: string
  article: string | null
  plural: string | null
  translation: string
  image_url: string | null
  audio_url: string | null
  phase: LeitnerPhase | null
  isLearned: boolean
  contextSentence?: string | null
}

/** Ein selbst eingetragenes Wort für die Lektion „Eigene Wörter" (Migration 23). */
export interface AddOwnWordInput {
  level: string
  /** Deutsches Wort, bei Nomen mit Artikel („das Haus"). */
  word: string
  /** Übersetzung in der Sprache der Oberfläche. */
  translation: string
  uiLanguage: string
}

export type AddOwnWordResult =
  /** `activated`: Die Lektion lernt schon — das Wort liegt sofort in Phase 1. */
  | { success: true; cardId: string; activated: boolean }
  | { success: false; error: 'invalid' | 'exists' | 'limit' | 'failed' }

export interface AddCardsResult {
  success: boolean
  added: number
}

/**
 * Eine Vokabel im Phasen-Inspektor („in ein Fach hineinschauen").
 *
 * Trägt den zusammengefassten Wort-Lernstand mit, damit die Liste den
 * Zwischenschritt „halb gewusst" zeigen kann, ohne ihn im Client erneut aus
 * Rohwerten abzuleiten.
 */
export interface PhaseCardView extends WordBoxState {
  id: string
  word_de: string
  article: string | null
  translation: string
  lesson: string
}

/** Inhalt eines einzelnen Fachs, serverseitig gefiltert und sortiert. */
export interface PhaseCardsResult {
  key: BoxBucketKey
  cards: PhaseCardView[]
  /** Wie viele Vokabeln das Fach insgesamt enthält (auch über `cards` hinaus). */
  total: number
  /** True, wenn die Liste bei `PHASE_INSPECTOR_LIMIT` abgeschnitten wurde. */
  truncated: boolean
}

/** Verteilung der Vokabeln eines Sprachniveaus über die sieben Fächer. */
export type VocabularyBoxSummary = BoxSummary

/** Eine Entscheidung im „Vokabeln einstufen"-Durchlauf (Pre-Assessment). */
export interface AssessmentDecision {
  cardId: string
  alreadyKnown: boolean
  /** Explicit in assessments; omitted only when manually adding both directions. */
  direction?: VocabularyDirection
}

export interface SubmitAssessmentResult {
  success: boolean
  /** Karten, die als bekannt in Phase 6 gelegt wurden. */
  addedKnown: number
  /** Karten, die als unbekannt in Phase 1 gelegt wurden (sofort fällig). */
  addedNew: number
}

/**
 * Wählt die Übersetzung passend zur Muttersprache mit klarer Fallback-Kette.
 * Gibt notfalls einen leeren String zurück – die UI zeigt dann einen
 * Empty-State statt einer kaputten Karte.
 */
export function resolveTranslation(
  card: Pick<VocabularyCardRow, 'translation_ru' | 'translation_tr' | 'translation_en'> & { translation_uk?: string | null },
  nativeLanguage: string | null
): string {
  return resolveVocabularyTranslation(card, nativeLanguage)?.text ?? ''
}

export function isHardForNativeLanguage(
  card: Pick<VocabularyCardRow, 'is_hard_for_ru' | 'is_hard_for_tr'>,
  nativeLanguage: string | null
): boolean {
  const locale = vocabularyNativeLocale(nativeLanguage)
  if (locale === 'ru') return card.is_hard_for_ru ?? false
  if (locale === 'tr') return card.is_hard_for_tr ?? false
  return false
}
