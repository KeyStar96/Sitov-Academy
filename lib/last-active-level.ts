import 'server-only'
import { cache } from 'react'
import { z } from 'zod'
import { requestSession } from '@/lib/request-session'
import { getRpcError } from '@/lib/rpc-errors'
import { modeFromActivity, type LearningMode } from '@/lib/mode-targets'

const activity = z.object({
  level: z.string(),
  mode: z.string().nullable(),
  at: z.string().nullable().optional(),
  unit_label: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
})

const response = z.object({
  level: z.string().nullable(),
  mode: z.string().nullable(),
  source: z.enum(['activity', 'started', 'unlocked', 'none']),
  levels: z.array(activity),
})

export interface LevelActivity {
  level: string
  mode: LearningMode | null
  /** Letzte Stelle: Lektion der letzten Vokabel/Aufnahme bzw. Einheit des Grammatik-Themas. */
  unitLabel: string | null
  /** Grammatik-Thema des letzten Versuchs. */
  topic: string | null
}

export interface LastActiveLevel {
  level: string | null
  mode: LearningMode | null
  source: 'activity' | 'started' | 'unlocked' | 'none'
  /** Je freigeschaltetem Niveau mit Lernhandlung, jüngstes zuerst. */
  levels: LevelActivity[]
}

/**
 * Das zuletzt gelernte Niveau (Migration 32, R5/R10): PostgreSQL entscheidet
 * aus den eigenen Lernhandlungen. `null` heißt „konnte nicht geladen werden" —
 * dann greifen die bisherigen Rückfälle (erstes angefangenes Niveau auf Home,
 * Browser-Speicher im Reiter „Lernen"), nie eine erfundene Antwort.
 *
 * Pro Anfrage nur einmal gelesen: Layout, Home und Niveau-Seite teilen sich
 * das Ergebnis.
 */
export const loadLastActiveLevel = cache(async (): Promise<LastActiveLevel | null> => {
  try {
    const { supabase, user } = await requestSession()
    if (!user) return null
    const { data, error } = await supabase.rpc('get_last_active_level')
    if (error || getRpcError(data)) {
      console.error('[last-active-level] unavailable')
      return null
    }
    const parsed = response.safeParse(data)
    if (!parsed.success) {
      console.error('[last-active-level] invalid_response')
      return null
    }
    return {
      level: parsed.data.level,
      mode: modeFromActivity(parsed.data.mode),
      source: parsed.data.source,
      levels: parsed.data.levels.map(entry => ({
        level: entry.level,
        mode: modeFromActivity(entry.mode),
        unitLabel: entry.unit_label ?? null,
        topic: entry.topic ?? null,
      })),
    }
  } catch {
    console.error('[last-active-level] unavailable')
    return null
  }
})
