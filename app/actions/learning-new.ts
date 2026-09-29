'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { LEARNING_SEEN_KINDS } from '@/lib/learning-new'
import { getRpcError } from '@/lib/rpc-errors'

const seenSchema = z.object({ kind: z.enum(LEARNING_SEEN_KINDS), key: z.string().min(1).max(80) })

/**
 * Gesehen-Quittung: Die Person hat ein Objekt geöffnet (Seite, Knoten, Video,
 * Ordner) — nicht bloß in einer Liste gesehen. PostgreSQL legt die Quittung
 * nur an, wenn das Objekt für die Person gerade wirklich neu ist.
 *
 * Bewusst ohne `revalidatePath`: Ein Neuladen mitten in einer Übung wäre
 * störend. Wer die Zähler sofort aktualisieren will, ruft `router.refresh()` auf.
 */
export async function markLearningSeen(kind: string, key: string): Promise<{ success: boolean; marked: boolean }> {
  const parsed = seenSchema.safeParse({ kind, key })
  if (!parsed.success) return { success: false, marked: false }
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('mark_learning_seen', { p_kind: parsed.data.kind, p_object_key: parsed.data.key })
    if (error || getRpcError(data)) { console.error('[learning-new] mark_failed'); return { success: false, marked: false } }
    const marked = typeof data === 'object' && data !== null && (data as { marked?: unknown }).marked === true
    return { success: true, marked }
  } catch { console.error('[learning-new] mark_failed'); return { success: false, marked: false } }
}
