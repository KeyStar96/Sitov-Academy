/**
 * Wort-Ebene des Phase-6-Karteikastens.
 *
 * `lib/leitner.ts` beschreibt eine einzelne *Abfragerichtung*. In der Datenbank
 * liegt je Vokabel und Richtung eine eigene Zeile in
 * `vocabulary_direction_progress` — eine Lektion mit 84 neuen Vokabeln ergibt
 * also 168 Aufgaben (84× Deutsch → eigene Sprache, 84× eigene Sprache →
 * Deutsch).
 *
 * Der Lernende denkt aber nicht in Richtungen, sondern in Vokabeln. Dieses
 * Modul fasst beide Richtungen zu *einem* Lernstand zusammen. Die Regel:
 *
 *   Eine Vokabel steht in der Phase ihrer **schwächeren** Richtung.
 *
 * Damit rückt sie erst dann eine Phase weiter, wenn beide Richtungen bestanden
 * sind — genau die didaktische Anforderung. Der Zwischenschritt, in dem nur
 * eine Richtung schon weiter ist, heißt hier „halb gewusst" und wird in der
 * Oberfläche sichtbar gemacht, statt ihn stillschweigend zu verschlucken.
 *
 * Die Zusammenfassung ist bewusst reine Anzeige-Logik: Der Lernstand je
 * Richtung bleibt unverändert in der Datenbank, und die Terminplanung
 * (`applyLeitnerAnswer`) arbeitet weiter pro Richtung. Nichts hier darf eine
 * Bewertung treffen — das bleibt in PostgreSQL (R5).
 */

import {
  LEITNER_LEARNED_BOX,
  LEITNER_PHASES,
  PHASE_INTERVALS_IN_DAYS,
  normalizeBox,
  type LeitnerPhase,
  type VocabularyReviewDirection,
} from '@/lib/leitner'

/**
 * Deckungsgleich mit `VocabularyDirection` aus `lib/types/vocabulary.ts`. Die
 * Herkunft aus `lib/leitner.ts` hält dieses Modul frei von einem Import-Zyklus
 * — die Typdatei baut ihre Ansichts-Typen auf `WordBoxState` auf.
 */
type VocabularyDirection = VocabularyReviewDirection

export const VOCABULARY_DIRECTIONS: readonly VocabularyDirection[] = ['de_to_native', 'native_to_de']

/** Rohzeile aus `vocabulary_direction_progress`, wie sie die Leseabfragen liefern. */
export interface DirectionProgressRow {
  direction: string
  box_number: number | null
  next_review_date?: string | null
}

/** Lernstand einer einzelnen Abfragerichtung, aufbereitet für die Anzeige. */
export interface DirectionBoxState {
  phase: LeitnerPhase
  isLearned: boolean
  isDue: boolean
}

/** Zusammengefasster Lernstand einer Vokabel über beide Richtungen. */
export interface WordBoxState {
  /** Phase der Vokabel: die schwächere der beiden Richtungen. */
  phase: LeitnerPhase
  /** Erst wenn *beide* Richtungen durch Phase 6 sind, gilt die Vokabel als gelernt. */
  isLearned: boolean
  /**
   * Genau eine Richtung ist schon weiter als die andere — der sichtbare
   * Zwischenschritt zwischen zwei Phasen.
   */
  isHalfKnown: boolean
  /** Mindestens eine Richtung wartet gerade auf eine Antwort. */
  isDue: boolean
  /** Richtungen, die den Sprung aus `phase` heraus schon geschafft haben (0–2). */
  clearedDirections: 0 | 1 | 2
  directions: Record<VocabularyDirection, DirectionBoxState>
}

function isDirection(value: string): value is VocabularyDirection {
  return value === 'de_to_native' || value === 'native_to_de'
}

function directionState(row: DirectionProgressRow, now: number): DirectionBoxState {
  const box = normalizeBox(row.box_number)
  const learned = box === LEITNER_LEARNED_BOX
  return {
    phase: (learned ? 6 : box) as LeitnerPhase,
    isLearned: learned,
    isDue: !learned && !!row.next_review_date && Date.parse(row.next_review_date) <= now,
  }
}

/**
 * Fasst die Zeilen *einer* Vokabel zu einem Wort-Lernstand zusammen.
 *
 * Gibt `null` zurück, solange nicht beide Richtungen angelegt sind: Die Vokabel
 * liegt dann noch gar nicht im Karteikasten und gehört in keine Phase. Die
 * Übersicht zählt solche Wörter getrennt als „noch nicht aufgenommen".
 */
export function computeWordBoxState(
  rows: readonly DirectionProgressRow[],
  now: number = Date.now()
): WordBoxState | null {
  const byDirection = new Map<VocabularyDirection, DirectionBoxState>()
  for (const row of rows) {
    if (isDirection(row.direction)) byDirection.set(row.direction, directionState(row, now))
  }
  if (byDirection.size < VOCABULARY_DIRECTIONS.length) return null

  const states = VOCABULARY_DIRECTIONS.map((direction) => byDirection.get(direction)!)
  const phase = Math.min(...states.map((state) => state.phase)) as LeitnerPhase
  const isLearned = states.every((state) => state.isLearned)
  // „Weiter" heißt: diese Richtung hat die Phase der Vokabel bereits verlassen.
  // Bei einer gelernten Richtung in Phase 6 zählt auch der Sprung ins Archiv.
  const cleared = states.filter((state) => state.phase > phase || (state.isLearned && !isLearned)).length

  return {
    phase,
    isLearned,
    isHalfKnown: !isLearned && cleared === 1,
    isDue: states.some((state) => state.isDue),
    clearedDirections: cleared as 0 | 1 | 2,
    directions: {
      de_to_native: byDirection.get('de_to_native')!,
      native_to_de: byDirection.get('native_to_de')!,
    },
  }
}

/**
 * Obergrenze der Detailliste eines Fachs — ein Fach mit 900 Wörtern soll den
 * Browser nicht sprengen. Lebt hier statt in `app/actions/vocabulary.ts`: ein
 * `'use server'`-Modul darf ausschließlich asynchrone Funktionen exportieren,
 * eine Konstante darin nimmt dem ganzen Modul seine Exporte.
 */
export const PHASE_INSPECTOR_LIMIT = 300

export type BoxBucketKey = LeitnerPhase | 'learned'

export const BOX_BUCKET_KEYS: readonly BoxBucketKey[] = [...LEITNER_PHASES, 'learned']

export interface BoxBucket {
  key: BoxBucketKey
  /** Vokabeln in dieser Phase. */
  count: number
  /** Davon solche, bei denen erst eine der beiden Richtungen sitzt. */
  halfKnown: number
  /** Davon solche, die gerade auf eine Antwort warten. */
  due: number
}

export interface BoxSummary {
  buckets: BoxBucket[]
  /** Vokabeln in den Phasen 1–6 (ohne Archiv). */
  inPhases: number
  /** Vokabeln im Archiv „gelernt". */
  learned: number
  /** Vokabeln der Auswahl, die noch in keiner Phase liegen. */
  untouched: number
  /** Alle Vokabeln der Auswahl. */
  total: number
  /** Fällige Vokabeln über alle Phasen. */
  due: number
  /**
   * Gewichteter Gesamtfortschritt in Prozent: nicht aufgenommen = 0,
   * Phase n = n/7, gelernt = 7/7. Eine halb gewusste Vokabel zählt einen
   * halben Schritt mehr — der Zwischenschritt soll sich auch im Balken lohnen.
   */
  percent: number
}

function emptyBuckets(): Map<BoxBucketKey, BoxBucket> {
  return new Map(BOX_BUCKET_KEYS.map((key) => [key, { key, count: 0, halfKnown: 0, due: 0 }]))
}

/**
 * Zählt Vokabeln in die sieben Fächer des Karteikastens.
 *
 * `states` enthält `null` für jede Vokabel, die noch nicht in beiden
 * Richtungen aufgenommen ist — diese senken den Gesamtfortschritt, tauchen
 * aber in keinem Fach auf.
 */
export function summarizeBox(states: readonly (WordBoxState | null)[]): BoxSummary {
  const buckets = emptyBuckets()
  let learned = 0
  let untouched = 0
  let due = 0
  let score = 0

  for (const state of states) {
    if (!state) {
      untouched += 1
      continue
    }
    const bucket = buckets.get(state.isLearned ? 'learned' : state.phase)!
    bucket.count += 1
    if (state.isHalfKnown) bucket.halfKnown += 1
    if (state.isDue) {
      bucket.due += 1
      due += 1
    }
    if (state.isLearned) {
      learned += 1
      score += LEITNER_LEARNED_BOX
    } else {
      score += state.phase + (state.isHalfKnown ? 0.5 : 0)
    }
  }

  const total = states.length
  const inPhases = LEITNER_PHASES.reduce((sum, phase) => sum + buckets.get(phase)!.count, 0)

  return {
    buckets: BOX_BUCKET_KEYS.map((key) => buckets.get(key)!),
    inPhases,
    learned,
    untouched,
    total,
    due,
    percent: total === 0 ? 0 : Math.round((score / (total * LEITNER_LEARNED_BOX)) * 100),
  }
}

/** Lernstand einer Lektion, abgeleitet aus denselben Wort-Lernständen. */
export interface LessonBoxStat {
  lesson: string
  total: number
  /** Vokabeln in den Phasen 1–6. */
  active: number
  /** Vokabeln im Archiv „gelernt". */
  learned: number
  /** Vokabeln, die noch nicht in beiden Richtungen aufgenommen sind. */
  untouched: number
  /** Vokabeln, bei denen mindestens eine Richtung wartet. */
  due: number
  /** Im Lernweg ausgeschaltet (Migration 25): Lernstand bleibt, geübt wird nicht. */
  paused?: boolean
}

/**
 * Eine Lektion liegt in der Lernbox, sobald sie Lernstand hat (Einstufung oder
 * „alle Wörter in Phase 1") und im Lernweg nicht ausgeschaltet ist.
 */
export function isLessonInBox(stat: Pick<LessonBoxStat, 'active' | 'learned' | 'paused'>): boolean {
  return stat.active + stat.learned > 0 && !stat.paused
}

/**
 * Zählt Vokabeln je Lektion.
 *
 * Teilt die Definitionen mit `summarizeBox`: „gelernt" heißt beide Richtungen
 * im Archiv, „fällig" heißt mindestens eine Richtung wartet. Dadurch können
 * Lektionsliste und Fächer-Übersicht nicht widersprechen.
 */
export function summarizeLessons(
  entries: readonly { lesson: string; state: WordBoxState | null }[]
): LessonBoxStat[] {
  const stats = new Map<string, LessonBoxStat>()
  for (const { lesson, state } of entries) {
    const stat = stats.get(lesson) ?? { lesson, total: 0, active: 0, learned: 0, untouched: 0, due: 0 }
    stat.total += 1
    if (!state) stat.untouched += 1
    else if (state.isLearned) stat.learned += 1
    else {
      stat.active += 1
      if (state.isDue) stat.due += 1
    }
    stats.set(lesson, stat)
  }
  return [...stats.values()].sort((a, b) => a.lesson.localeCompare(b.lesson, 'de-DE', { numeric: true }))
}

/** Ruhezeit, die eine Vokabel beim Eintritt in diese Phase bekommt. */
export function phaseIntervalInDays(key: BoxBucketKey): number {
  return key === 'learned' ? 0 : PHASE_INTERVALS_IN_DAYS[key]
}

/**
 * Farbband der Fächer, gleich verwendet von Übersicht, Balken und Detailliste:
 * Markenorange für die frischen Phasen, Violett für die Festigung, Grün für
 * Langzeit und Archiv. Deckungsgleich mit `phaseBarClasses` in
 * `lib/vocabulary-ui.ts`, nur um Flächen- und Rahmentöne erweitert.
 */
export interface PhaseTone {
  /** Vollton für Balken und Punkte. */
  fill: string
  /** Textfarbe mit AA-Kontrast auf Flächen (nie der Vollton auf Weiß). */
  text: string
  /** Dezente Fläche hinter Zahl und Icon. */
  soft: string
}

export function phaseTone(key: BoxBucketKey): PhaseTone {
  if (key === 'learned' || key === 6) {
    return {
      fill: 'bg-[var(--success)]',
      text: 'text-[var(--success)]',
      soft: 'bg-[var(--success)]/10',
    }
  }
  if (key >= 4) {
    return {
      fill: 'bg-[var(--violet)]',
      text: 'text-[var(--violet)]',
      soft: 'bg-[var(--violet)]/10',
    }
  }
  return {
    fill: 'bg-[var(--accent)]',
    text: 'text-[var(--accent-text)]',
    soft: 'bg-[var(--accent)]/10',
  }
}
