import { LEITNER_PHASES, type LeitnerPhase } from '@/lib/leitner'

/**
 * Visuelle Merkmale eines Sprachniveaus (CEFR-Stufe).
 *
 * Bewusst KEINE zunehmende Abdunklung mehr: Höhere Niveaus (B1, B2, C1 …)
 * wirkten dadurch wie deaktiviert/ausgegraut. Stattdessen bekommt jede Stufe
 * eine eigene, klar unterscheidbare Farbwelt.
 */
export interface LevelVisual {
  /** Verlauf für das Icon-Badge (`bg-gradient-to-br`). */
  gradient: string
  /** Verlauf für den Fortschrittsbalken (`bg-gradient-to-r`). */
  bar: string
  /** Dezente Hintergrundfläche hinter dem Icon (mit Dark-Mode-Variante). */
  soft: string
  /** Vollton-Textfarbe für kleine Akzente/Badges. */
  text: string
}

/**
 * Farbcodierung der Sprachniveaus – von frischen Tönen (A) über kräftige
 * Akzente (B) bis zu edlem Violett/Gold (C):
 *
 * - A1 → frisches Smaragd/Türkis
 * - A2 → helles Himmelblau
 * - B1 → kräftiges Marken-Orange
 * - B2 → kräftiges Rosé/Pink
 * - C1 → edles Violett
 * - C2 → edles Gold
 *
 * Der Parameter akzeptiert vollständige IDs wie `"A1.1"`; ausgewertet wird die
 * CEFR-Basisstufe (die ersten beiden Zeichen).
 */
export function levelVisual(levelId: string): LevelVisual {
  const stage = levelId.trim().slice(0, 2).toUpperCase()

  switch (stage) {
    case 'A1':
      return {
        gradient: 'from-emerald-400 to-teal-500',
        bar: 'from-emerald-400 to-teal-500',
        soft: 'bg-emerald-50 dark:bg-emerald-950/40',
        text: 'text-emerald-700 dark:text-emerald-300',
      }
    case 'A2':
      return {
        gradient: 'from-sky-400 to-blue-500',
        bar: 'from-sky-400 to-blue-500',
        soft: 'bg-sky-50 dark:bg-sky-950/40',
        text: 'text-sky-700 dark:text-sky-300',
      }
    case 'B1':
      return {
        gradient: 'from-orange-400 to-[#FF5C00]',
        bar: 'from-orange-400 to-[#FF5C00]',
        soft: 'bg-orange-50 dark:bg-orange-950/40',
        text: 'text-[#CC4700] dark:text-orange-300',
      }
    case 'B2':
      return {
        gradient: 'from-rose-500 to-pink-600',
        bar: 'from-rose-500 to-pink-600',
        soft: 'bg-rose-50 dark:bg-rose-950/40',
        text: 'text-rose-700 dark:text-rose-300',
      }
    case 'C1':
      return {
        gradient: 'from-violet-500 to-purple-600',
        bar: 'from-violet-500 to-purple-600',
        soft: 'bg-violet-50 dark:bg-violet-950/40',
        text: 'text-violet-700 dark:text-violet-300',
      }
    case 'C2':
      return {
        gradient: 'from-amber-400 to-yellow-500',
        bar: 'from-amber-400 to-yellow-500',
        soft: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-700 dark:text-amber-300',
      }
    default:
      return {
        gradient: 'from-slate-400 to-slate-500',
        bar: 'from-slate-400 to-slate-500',
        soft: 'bg-slate-50 dark:bg-slate-800/50',
        text: 'text-slate-600 dark:text-slate-300',
      }
  }
}

/**
 * Artikel-Farben als zusätzliche visuelle Merkhilfe für das Genus.
 * Zentral hier hinterlegt, damit Trainer, Detailansicht und Einstufung
 * dieselbe Zuordnung verwenden.
 */
export function articleColorClass(article: string | null): string {
  switch (article) {
    case 'der':
      return 'text-blue-700 dark:text-blue-300'
    case 'die':
      return 'text-red-700 dark:text-red-300'
    case 'das':
      return 'text-green-700 dark:text-green-300'
    default:
      return 'text-[var(--foreground)]'
  }
}

/**
 * Farbliche Einstufung des Phasen-Badges in der Lektions-Detailansicht:
 * Markenorange (Phase 1–2), Violett (Phase 3–4), Grün (Phase 5–6);
 * „gelernt" erhält eine gefüllte, kontrastreiche Variante.
 */
export function phaseBadgeClasses(phase: LeitnerPhase | null, isLearned: boolean): string {
  if (isLearned) return 'vocabulary-phase-learned'
  if (phase === null) return 'bg-[var(--surface-muted)] text-[var(--muted)]'
  if (phase <= 2) return 'vocabulary-phase-new'
  if (phase <= 4) return 'vocabulary-phase-review'
  return 'vocabulary-phase-secure'
}

export type PhaseBucketKey = LeitnerPhase | 'learned'

export interface PhaseCountCard {
  phase: LeitnerPhase | null
  isLearned: boolean
}

export interface PhaseBucket {
  key: PhaseBucketKey
  count: number
}

export interface PhaseDistribution {
  buckets: PhaseBucket[]
  /** Karten in Phase 1–6 oder „gelernt" (ohne noch nicht übernommene). */
  totalInBox: number
  /** Alle Karten der Lektion inklusive unberührter und eigener. */
  totalCards: number
  /**
   * Gewichteter Fortschritt: unberührt = 0, Phase n = n/7, gelernt = 7/7.
   * Eigene Vokabeln (Phase 1) fließen mit ein.
   */
  overallPercent: number
}

/**
 * Zählt, wie viele Vokabeln in welcher Leitner-Phase stecken.
 * Unberührte Karten (`phase === null`) erscheinen in keinem Balken, senken
 * aber den Gesamtfortschritt, weil sie zur Lektion gehören.
 */
export function computePhaseDistribution(cards: readonly PhaseCountCard[]): PhaseDistribution {
  const counts: Record<LeitnerPhase, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  let learned = 0
  let score = 0

  for (const card of cards) {
    if (card.isLearned) {
      learned += 1
      score += 7
    } else if (card.phase !== null) {
      counts[card.phase] += 1
      score += card.phase
    }
  }

  const totalCards = cards.length
  const totalInBox = LEITNER_PHASES.reduce((sum, phase) => sum + counts[phase], 0) + learned

  return {
    buckets: [
      ...LEITNER_PHASES.map((phase) => ({ key: phase as PhaseBucketKey, count: counts[phase] })),
      { key: 'learned', count: learned },
    ],
    totalInBox,
    totalCards,
    overallPercent: totalCards === 0 ? 0 : Math.round((score / (totalCards * 7)) * 100),
  }
}

/** Brand accents identify early practice, review and secure knowledge in both themes. */
export function phaseBarClasses(key: PhaseBucketKey): { bar: string; label: string } {
  if (key === 'learned' || key === 6) return { bar: 'bg-[var(--success)]', label: 'text-[var(--success)]' }
  if (key >= 4) return { bar: 'bg-[var(--violet)]', label: 'text-[var(--violet)]' }
  return { bar: 'bg-[var(--accent)]', label: 'text-[var(--accent)]' }
}
