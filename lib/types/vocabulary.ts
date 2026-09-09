import type { LeitnerBox, LeitnerPhase } from '@/lib/leitner'
import type { Database } from '@/supabase/database.types'

export type VocabularyCardRow = Database['public']['Tables']['vocabulary_cards']['Row']

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

/** Lernstand einer Lektion für die Übersichtsseite. */
export interface LessonStat {
  lesson: string
  total: number
  /** Karten in den Phasen 1–6. */
  active: number
  /** Karten im Zustand „gelernt". */
  learned: number
  /** Noch nicht gestartete Karten. */
  untouched: number
  /** Aktuell fällige Karten. */
  due: number
}

export interface SubmitVocabularyAnswerInput {
  progressId: string
  isCorrect: boolean
}

export interface SubmitVocabularyAnswerResult {
  success: boolean
  previousPhase?: LeitnerPhase
  newPhase?: LeitnerPhase
  becameLearned?: boolean
  movedBack?: boolean
  intervalInDays?: number
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
  phase: LeitnerPhase | null
  isLearned: boolean
}

export interface AddCardsResult {
  success: boolean
  added: number
}

/** Eine Entscheidung im „Vokabeln einstufen"-Durchlauf (Pre-Assessment). */
export interface AssessmentDecision {
  cardId: string
  alreadyKnown: boolean
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
  card: Pick<VocabularyCardRow, 'translation_ru' | 'translation_tr' | 'translation_en'>,
  nativeLanguage: string | null
): string {
  if (nativeLanguage === 'Russisch' && card.translation_ru) return card.translation_ru
  if (nativeLanguage === 'Türkisch' && card.translation_tr) return card.translation_tr
  return card.translation_en ?? card.translation_ru ?? card.translation_tr ?? ''
}

export function isHardForNativeLanguage(
  card: Pick<VocabularyCardRow, 'is_hard_for_ru' | 'is_hard_for_tr'>,
  nativeLanguage: string | null
): boolean {
  if (nativeLanguage === 'Russisch') return card.is_hard_for_ru ?? false
  if (nativeLanguage === 'Türkisch') return card.is_hard_for_tr ?? false
  return false
}
