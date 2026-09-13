/**
 * Übungssätze des Aussprache-Trainers.
 *
 * Die Sätze liegen in `learning_reading_texts` mit UUID-Lerneinheiten (CEFR-Familien A1–C2).
 * Die Lernplattform routet feingranular (A1.1, A1.2, …) – diese Datei
 * mappt das Routen-Niveau auf die passende Familie, damit nur Sätze
 * des freigeschalteten Niveaus geladen werden.
 */

export const CEFR_FAMILIES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

export type CefrFamily = (typeof CEFR_FAMILIES)[number]

export interface PronunciationPrompt {
  id: string
  unitId: string
  title?: string
  lesson: string
  level?: string
  isActive?: boolean
  cefrLevel: CefrFamily
  sentenceDe: string
  focus: string | null
  audioUrl: string | null
  sortOrder: number
}

export function isCefrFamily(value: unknown): value is CefrFamily {
  return typeof value === 'string' && (CEFR_FAMILIES as readonly string[]).includes(value)
}

/**
 * Ordnet ein Dashboard-/Routen-Niveau der CEFR-Familie zu.
 * `A1.1`/`A1.2` → `A1`, `B2` → `B2`. Unbekanntes fällt auf `null`.
 */
export function cefrFamilyFromLevel(level: string): CefrFamily | null {
  const trimmed = level.trim().toUpperCase()
  if (isCefrFamily(trimmed)) return trimmed
  const family = trimmed.split('.')[0]
  return isCefrFamily(family) ? family : null
}
