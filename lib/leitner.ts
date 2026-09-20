/**
 * Phase-6-Leitner-Prinzip für den Vokabeltrainer.
 *
 * Sechs aktive Phasen plus einen terminalen Zustand „gelernt". In der
 * Datenbank liegt der Wert in `vocabulary_direction_progress.box_number`:
 * 1–6 sind die Lernphasen, 7 bedeutet dauerhaft gelernt und wird nicht mehr
 * abgefragt. Diese Aufteilung entspricht dem bereits bestehenden CHECK
 * (1..7) und der bisherigen Abfrage `box_number < 7` — die Umstellung ist
 * daher rückwärtskompatibel.
 */

export const LEITNER_PHASES = [1, 2, 3, 4, 5, 6] as const
export type LeitnerPhase = (typeof LEITNER_PHASES)[number]

/** Terminaler Zustand: die Vokabel sitzt und wird nicht mehr abgefragt. */
export const LEITNER_LEARNED_BOX = 7

export type LeitnerBox = LeitnerPhase | typeof LEITNER_LEARNED_BOX

/**
 * Ruhezeit in Tagen, die eine Vokabel beim *Eintritt* in eine Phase erhält.
 *
 * Erfolgsweg: Phase 1 → 2 (1 Tag) → 3 (3 Tage) → 4 (9 Tage) → 5 (29 Tage)
 * → 6 (90 Tage) → gelernt.
 * Der Wert von Phase 1 greift auf dem Fehlerweg: Wer bis in Phase 1
 * zurückrutscht, bekommt die Vokabel am nächsten Tag erneut vorgelegt.
 */
export const PHASE_INTERVALS_IN_DAYS: Readonly<Record<LeitnerPhase, number>> = {
  1: 1,
  2: 1,
  3: 3,
  4: 9,
  5: 29,
  6: 90,
}

export function isLeitnerPhase(value: number): value is LeitnerPhase {
  return Number.isInteger(value) && value >= 1 && value <= 6
}

/** Abfragemodus einer Karte: getippter Abruf oder Karteikarten-Selbsteinschätzung. */
export type VocabularyReviewMode = 'typed' | 'flashcard'

/**
 * Höchste Leitner-Phase, die noch im Karteikarten-Modus (Wiedererkennung)
 * abgefragt wird. Darüber wird getippt (aktiver Abruf).
 */
export const FLASHCARD_MAX_PHASE: LeitnerPhase = 2

/**
 * Legt den Abfragemodus einer fälligen Karte fest. Der Modus ist bewusst
 * deterministisch aus dem Lernstand ableitbar, damit der Server ihn beim
 * Bewerten identisch neu berechnen kann (R5): Ein Client kann keine Tipp-Karte
 * als Karteikarte selbst bewerten.
 *
 * Sätze werden immer getippt – ihre exakte Schreibweise ist der Lerninhalt und
 * darf nie zur Selbsteinschätzung herabgestuft werden. Frisch gelernte Wörter
 * (Phase 1–2) laufen zur Wiedererkennung als Karteikarte, reifere Wörter zum
 * aktiven Abruf als Texteingabe.
 *
 * Muss identisch zu `vocabulary_private.self_rating_allowed` in
 * `supabase/vps/18_vocabulary_self_rating.sql` bleiben.
 */
export function vocabularyReviewMode(
  box: number | null | undefined,
  format: 'word' | 'sentence'
): VocabularyReviewMode {
  if (format === 'sentence') return 'typed'
  const phase = Math.min(6, Math.max(1, Math.round(box ?? 1)))
  return phase <= FLASHCARD_MAX_PHASE ? 'flashcard' : 'typed'
}

/**
 * Bringt einen beliebigen Datenbankwert in einen gültigen Zustand.
 * Schützt vor Altbeständen und manuellen Eingriffen in der Live-Datenbank.
 */
export function normalizeBox(value: number | null | undefined): LeitnerBox {
  if (value === null || value === undefined || Number.isNaN(value)) return 1
  const rounded = Math.round(value)
  if (rounded >= LEITNER_LEARNED_BOX) return LEITNER_LEARNED_BOX
  if (rounded <= 1) return 1
  return rounded as LeitnerPhase
}

export function isLearned(box: number | null | undefined): boolean {
  return normalizeBox(box) === LEITNER_LEARNED_BOX
}

/**
 * Phase, in der eine Karte beim Antworten steckt. Eine bereits gelernte Karte
 * wird für die Rückstufung wie Phase 6 behandelt.
 */
function currentPhaseOf(box: LeitnerBox): LeitnerPhase {
  return box === LEITNER_LEARNED_BOX ? 6 : box
}

export interface LeitnerAnswerInput {
  /** Aktueller Wert aus `vocabulary_direction_progress.box_number`. */
  currentBox: number | null | undefined
  isCorrect: boolean
  /**
   * True, wenn die Vokabel für die Muttersprache des Lernenden als schwer
   * markiert ist (`is_hard_for_ru` / `is_hard_for_tr`).
   */
  isHardForNativeLanguage?: boolean
  /** Injizierbar, damit die Logik testbar bleibt. */
  now?: Date
}

export interface LeitnerAnswerResult {
  previousPhase: LeitnerPhase
  /** Neuer Wert für `box_number` (1–6 oder 7 für „gelernt"). */
  newBox: LeitnerBox
  /** Phase nach der Antwort; bei „gelernt" ist es Phase 6. */
  newPhase: LeitnerPhase
  becameLearned: boolean
  /** True, wenn die Vokabel eine Phase zurückgerutscht ist. */
  movedBack: boolean
  intervalInDays: number
  nextReviewDate: Date
}

function addDays(base: Date, days: number): Date {
  const result = new Date(base.getTime())
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Ruhezeit einer Phase, bei kontrastiv schweren Vokabeln halbiert
 * (mindestens ein Tag).
 */
export function intervalForPhase(phase: LeitnerPhase, isHardForNativeLanguage = false): number {
  const base = PHASE_INTERVALS_IN_DAYS[phase]
  return isHardForNativeLanguage ? Math.max(1, Math.floor(base / 2)) : base
}

/**
 * Wendet eine Antwort auf den Lernstand an.
 *
 * Richtig  → eine Phase weiter; aus Phase 6 heraus gilt die Vokabel als gelernt.
 * Falsch   → **exakt eine Phase zurück**, mindestens bis Phase 1. Der übrige
 *            Lernfortschritt bleibt erhalten; es wird nichts zurückgesetzt.
 */
export function applyLeitnerAnswer(input: LeitnerAnswerInput): LeitnerAnswerResult {
  const now = input.now ?? new Date()
  const box = normalizeBox(input.currentBox)
  const previousPhase = currentPhaseOf(box)

  if (input.isCorrect) {
    const becameLearned = previousPhase === 6
    const newPhase: LeitnerPhase = becameLearned ? 6 : ((previousPhase + 1) as LeitnerPhase)
    const intervalInDays = intervalForPhase(newPhase, input.isHardForNativeLanguage)

    return {
      previousPhase,
      newBox: becameLearned ? LEITNER_LEARNED_BOX : newPhase,
      newPhase,
      becameLearned,
      movedBack: false,
      intervalInDays,
      nextReviewDate: addDays(now, intervalInDays),
    }
  }

  const newPhase: LeitnerPhase = Math.max(1, previousPhase - 1) as LeitnerPhase
  const intervalInDays = intervalForPhase(newPhase, input.isHardForNativeLanguage)

  return {
    previousPhase,
    newBox: newPhase,
    newPhase,
    becameLearned: false,
    movedBack: newPhase < previousPhase || box === LEITNER_LEARNED_BOX,
    intervalInDays,
    nextReviewDate: addDays(now, intervalInDays),
  }
}

/**
 * Fortschritt einer einzelnen Vokabel in Prozent – für die ruhige
 * Fortschrittsanzeige im Trainer (keine Punkte, keine Bestenliste).
 */
export function phaseProgressPercent(box: number | null | undefined): number {
  const normalized = normalizeBox(box)
  if (normalized === LEITNER_LEARNED_BOX) return 100
  return Math.round(((normalized - 1) / LEITNER_PHASES.length) * 100)
}

/**
 * Neuberechnung des Wiederholungstermins für bestehende Lernstände.
 * Wird bei der Migration vom alten 7-Fächer-Intervallmodell genutzt.
 */
export function nextReviewDateForBox(
  box: number | null | undefined,
  isHardForNativeLanguage = false,
  now: Date = new Date()
): Date {
  const normalized = normalizeBox(box)
  if (normalized === LEITNER_LEARNED_BOX) {
    return addDays(now, intervalForPhase(6, isHardForNativeLanguage))
  }
  return addDays(now, intervalForPhase(normalized, isHardForNativeLanguage))
}

/**
 * Auswahl-Gewicht je Lernphase für die Session-Reihenfolge.
 * Niedrige Phasen kommen deutlich häufiger dran als hohe.
 */
export const PHASE_SELECTION_WEIGHTS: Readonly<Record<LeitnerPhase, number>> = {
  1: 1,
  2: 0.7,
  3: 0.4,
  4: 0.2,
  5: 0.1,
  6: 0.05,
}

/** Phase, in die bereits bekannte Vokabeln bei der Ersteinstufung gelegt werden. */
export const ASSESSMENT_KNOWN_PHASE: LeitnerPhase = 6

export function selectionWeightForBox(box: number | null | undefined): number {
  const normalized = normalizeBox(box)
  if (normalized === LEITNER_LEARNED_BOX) return 0
  return PHASE_SELECTION_WEIGHTS[normalized]
}

/**
 * Weighted-Random-Sampling ohne Zurücklegen (Efraimidis–Spirakis).
 * Höheres Gewicht → höhere Ziehungswahrscheinlichkeit, die relative
 * Reihenfolge bei gleichem Gewicht bleibt stabil.
 */
export function pickWeightedRandomOrder<T>(
  items: readonly T[],
  getWeight: (item: T) => number,
  random: () => number = Math.random
): T[] {
  if (items.length <= 1) return [...items]

  return items
    .map((item, index) => {
      const weight = getWeight(item)
      const raw = random()
      const unit = raw <= 0 ? Number.MIN_VALUE : raw >= 1 ? 1 - Number.EPSILON : raw
      const key = weight > 0 ? Math.pow(unit, 1 / weight) : Number.NEGATIVE_INFINITY
      return { item, key, index }
    })
    .sort((left, right) => {
      if (right.key !== left.key) return right.key - left.key
      return left.index - right.index
    })
    .map((entry) => entry.item)
}
