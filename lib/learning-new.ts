import { z } from 'zod'
import { LEARNING_MODES, type LearningMode } from '@/lib/mode-targets'

/**
 * „Neu" pro Person (Phase 6.1). PostgreSQL entscheidet, was neu ist
 * (`get_learning_new_counts`, `get_learning_new_items`, Migration 42); dieses
 * Modul beschreibt nur die Antworten und prüft sie beim Lesen.
 */
export const LEARNING_SEEN_KINDS = ['level', 'vocabulary_lesson', 'path', 'special_branch', 'pronunciation_text', 'media_folder', 'video', 'presentation', 'trainer'] as const
export type LearningSeenKind = (typeof LEARNING_SEEN_KINDS)[number]

export interface LevelNew {
  /** Das Niveau selbst wurde nach dem ersten Besuch freigeschaltet und ist noch nicht geöffnet. */
  level: boolean
  /** Alles Neue in diesem Niveau (Niveau, Modi, Inhalte). */
  total: number
  /** Neue Inhalte je Modus. */
  modes: Record<LearningMode, number>
  /** Der Modus selbst wurde nach dem ersten Besuch wieder eingeschaltet und ist noch nicht geöffnet. */
  modeNew: Record<LearningMode, boolean>
}
export interface LearningNewCounts {
  any: boolean
  levels: Record<string, LevelNew>
  /** Niveaus, deren erster Besuch schon erfasst ist; dort kann später Veröffentlichtes „neu" sein. */
  visited: string[]
}
export type LearningNewItems = Partial<Record<LearningSeenKind, string[]>>

const modeRecord = <T extends z.ZodType>(value: T) => z.object({ vocabulary: value, path: value, pronunciation: value, media: value })
const countsSchema = z.object({
  success: z.literal(true),
  any: z.boolean(),
  levels: z.record(z.string(), z.object({
    level: z.boolean(), total: z.number().int().nonnegative(),
    modes: modeRecord(z.number().int().nonnegative()), modeNew: modeRecord(z.boolean()),
  })),
  visited: z.array(z.string()).default([]),
})
const itemsSchema = z.object({ success: z.literal(true), items: z.record(z.string(), z.array(z.string())), lessons: z.record(z.string(), z.string()).default({}) })

/** `null`, wenn die Antwort fehlerhaft ist: dann wird nichts als neu gezeigt. */
export function parseLearningNewCounts(value: unknown): LearningNewCounts | null {
  const parsed = countsSchema.safeParse(value)
  return parsed.success ? { any: parsed.data.any, levels: parsed.data.levels, visited: parsed.data.visited } : null
}

/** Neue Objekte eines Niveaus: Schlüssel je Art und Vokabel-Lektionen unter ihrem Namen (Name → Objekt-Schlüssel). */
export interface LevelNewItems { items: LearningNewItems; lessonIds: Record<string, string> }
export const NO_NEW_ITEMS: LevelNewItems = { items: {}, lessonIds: {} }

export function parseLearningNewItems(value: unknown): LevelNewItems {
  const parsed = itemsSchema.safeParse(value)
  if (!parsed.success) return NO_NEW_ITEMS
  const items: LearningNewItems = {}
  for (const kind of LEARNING_SEEN_KINDS) if (parsed.data.items[kind]?.length) items[kind] = parsed.data.items[kind]
  return { items, lessonIds: Object.fromEntries(Object.entries(parsed.data.lessons).map(([id, label]) => [label, id])) }
}

/** Trägt ein Modus ein „Neu"-Kennzeichen: neue Inhalte oder der Modus selbst. */
export function modeIsNew(entry: LevelNew | undefined, mode: LearningMode): boolean {
  return !!entry && (entry.modes[mode] > 0 || entry.modeNew[mode])
}

/** Alle Modi eines Niveaus, die ein Kennzeichen tragen. */
export function newModes(entry: LevelNew | undefined): LearningMode[] {
  return LEARNING_MODES.filter(mode => modeIsNew(entry, mode))
}

/** Schlüssel der Trainer-Quittung: `<Niveau>:<Trainer der Datenbank>`. */
export function trainerKey(level: string, trainer: string): string {
  return `${level}:${trainer}`
}
